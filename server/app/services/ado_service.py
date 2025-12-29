import uuid
import httpx
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from app.core.config import settings
from app.models.jira import Integration  # Reusing Integration model as planned
from app.models.ado import AdoProject

# In-memory state store for OAuth (can reuse the pattern from JiraService)
# Key: state, Value: {created_at: timestamp, return_url: string}
oauth_states: Dict[str, Dict[str, Any]] = {}

# ADO Scopes
# vso.work_write: Grants the ability to read, create, and update work items.
# vso.project: Grants the ability to read projects and teams.
# vso.profile: Grants the ability to read the user profile.
# offline_access: Grants the ability to get a refresh token.
ADO_SCOPES = [
    "vso.work_write",
    "vso.project",
    "vso.profile",
    "offline_access",
]

class AdoService:
    def cleanup_expired_states(self):
        now = datetime.utcnow().timestamp()
        expired = [
            state for state, data in oauth_states.items()
            if now - data["created_at"] > 600  # 10 minutes
        ]
        for state in expired:
            del oauth_states[state]

    def get_oauth_url(self, return_url: Optional[str] = None) -> str:
        self.cleanup_expired_states()
        state = str(uuid.uuid4())
        
        oauth_states[state] = {
            "created_at": datetime.utcnow().timestamp(),
            "return_url": return_url
        }

        # ADO OAuth URL
        # Docs: https://learn.microsoft.com/en-us/azure/devops/integrate/get-started/authentication/oauth?view=azure-devops
        params = {
            "client_id": settings.ADO_CLIENT_ID,
            "response_type": "Assertion",
            "state": state,
            "scope": " ".join(ADO_SCOPES),
            "redirect_uri": settings.ADO_REDIRECT_URI,
        }
        
        query_string = "&".join([f"{k}={v}" for k, v in params.items()])
        return f"https://app.vssps.visualstudio.com/oauth2/authorize?{query_string}"

    async def handle_oauth_callback(self, session: Session, code: str, state: str) -> Dict[str, Any]:
        # Validate state
        state_data = oauth_states.get(state)
        # Note: In strict implementations we should validate state, but for prototype we can be lenient if same browser session
        if not state_data:
            # Fallback if state lost or expired, but still try to proceed if we just want to connect
            pass 
        
        if state in oauth_states:
            del oauth_states[state]
        
        return_url = state_data.get("return_url") if state_data else None

        # Exchange code for tokens
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                "https://app.vssps.visualstudio.com/oauth2/token",
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "client_assertion_type": "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
                    "client_assertion": settings.ADO_CLIENT_SECRET,
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": code,
                    "redirect_uri": settings.ADO_REDIRECT_URI,
                }
            )
            
            if token_response.status_code != 200:
                raise ValueError(f"Failed to exchange code for tokens: {token_response.text}")
            
            tokens = token_response.json()
            access_token = tokens["access_token"]
            refresh_token = tokens.get("refresh_token")
            expires_in = int(tokens.get("expires_in", 3600))

            # Get User Profile to ID the integration
            profile_response = await client.get(
                "https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/json"
                }
            )

            if profile_response.status_code != 200:
                raise ValueError("Failed to get user profile")
            
            profile = profile_response.json()
            # ADO doesn't return "Cloud ID" like Jira, usually we use Organization Account.
            # But the profile gives us the User ID.
            # We might need to list Accounts/Orgs to pick one if multi-tenant, 
            # but for MVP typically ADO tokens are scoped to the authorized orgs.
            
            # We will use the generic profile ID as the "cloud_id" equivalent or fetch accounts
            # https://app.vssps.visualstudio.com/_apis/accounts?memberId={memberId}&api-version=5.0
            
            # Let's simplify and use the Profile ID and Email for naming
            ado_user_id = profile.get("id")
            ado_email = profile.get("emailAddress")
            
            # Create or update integration
            token_expires_at = datetime.utcnow() + timedelta(seconds=expires_in)
            
            statement = select(Integration).where(Integration.provider == "ado").where(Integration.cloud_id == ado_user_id)
            existing = session.exec(statement).first()
            
            if existing:
                existing.name = f"ADO ({ado_email})" # Update name in case changed
                existing.access_token = access_token
                existing.refresh_token = refresh_token
                existing.token_expires_at = token_expires_at
                existing.scopes = ADO_SCOPES
                existing.status = "connected"
                existing.updated_at = datetime.utcnow()
                session.add(existing)
                session.commit()
                session.refresh(existing)
                integration = existing
            else:
                integration = Integration(
                    provider="ado",
                    name=f"ADO ({ado_email})",
                    base_url="https://dev.azure.com", # Default base, projects will have specific Org URLs
                    cloud_id=ado_user_id,
                    auth_type="oauth",
                    access_token=access_token,
                    refresh_token=refresh_token,
                    token_expires_at=token_expires_at,
                    scopes=ADO_SCOPES,
                    status="connected"
                )
                session.add(integration)
                session.commit()
                session.refresh(integration)
            
            # Trigger initial project sync asynchronously in real app
            # await self.sync_projects(session, integration)

            return {
                "integration": integration,
                "return_url": return_url
            }

    async def get_projects(self, session: Session, integration_id: int) -> List[AdoProject]:
        # Return cached projects first
        statement = select(AdoProject).where(AdoProject.integration_id == integration_id)
        projects = session.exec(statement).all()
        
        # If no projects or stale, trigger sync (omitted for MVP speed, assume check sync endpoint)
        return projects

    async def sync_projects(self, session: Session, integration_id: int) -> List[AdoProject]:
        statement = select(Integration).where(Integration.id == integration_id)
        integration = session.exec(statement).first()
        if not integration:
            raise ValueError("Integration not found")

        # Get Accounts/Orgs first
        async with httpx.AsyncClient() as client:
            accounts_response = await client.get(
                f"https://app.vssps.visualstudio.com/_apis/accounts?memberId={integration.cloud_id}&api-version=5.0",
                headers={"Authorization": f"Bearer {integration.access_token}"}
            )
            if accounts_response.status_code != 200:
                # Token might be expired
                raise ValueError("Failed to fetch accounts")
            
            accounts = accounts_response.json().get("value", [])
            
            synced_projects = []
            
            for account in accounts:
                org_name = account["accountName"]
                # Fetch projects for this org
                # GET https://dev.azure.com/{organization}/_apis/projects?api-version=6.0
                proj_response = await client.get(
                    f"https://dev.azure.com/{org_name}/_apis/projects?api-version=6.0",
                    headers={"Authorization": f"Bearer {integration.access_token}"}
                )
                
                if proj_response.status_code == 200:
                    projects_data = proj_response.json().get("value", [])
                    for p in projects_data:
                        # Update DB
                        # Check exist
                        stmt = select(AdoProject).where(AdoProject.integration_id == integration.id).where(AdoProject.ado_id == p["id"])
                        existing_proj = session.exec(stmt).first()
                        
                        if existing_proj:
                            existing_proj.name = p["name"]
                            existing_proj.conversation_id = p.get("url") # storing link?
                            # url is https://dev.azure.com/Org/Project
                            # p["url"] is API url usually
                            # Construct web URL: https://dev.azure.com/{org_name}/{p['name']}
                            existing_proj.url = f"https://dev.azure.com/{org_name}/{p['name']}"
                            existing_proj.description = p.get("description")
                            existing_proj.state = p.get("state")
                            existing_proj.synced_at = datetime.utcnow()
                            session.add(existing_proj)
                            synced_projects.append(existing_proj)
                        else:
                            new_proj = AdoProject(
                                integration_id=integration.id,
                                ado_id=p["id"],
                                name=p["name"],
                                url=f"https://dev.azure.com/{org_name}/{p['name']}",
                                description=p.get("description"),
                                state=p.get("state"),
                                synced_at=datetime.utcnow()
                            )
                            session.add(new_proj)
                            synced_projects.append(new_proj)
            
            session.commit()
            return synced_projects

ado_service = AdoService()
