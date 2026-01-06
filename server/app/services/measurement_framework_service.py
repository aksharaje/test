"""
Measurement Framework Builder Service

Business logic for AI-powered measurement framework building.
"""
import json
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from app.models.measurement_framework import (
    MeasurementFrameworkSession,
    FrameworkMetric,
    FrameworkDataSource,
    FrameworkDashboard,
    MeasurementFrameworkSessionCreate,
)
from app.models.knowledge_base import KnowledgeBase
from openai import OpenAI


class MeasurementFrameworkService:
    """Service for managing measurement framework sessions"""

    def __init__(self):
        self._client: Optional[OpenAI] = None

    @property
    def client(self) -> OpenAI:
        if not self._client:
            from app.core.config import settings
            api_key = settings.OPENROUTER_API_KEY
            if not api_key:
                raise ValueError("OPENROUTER_API_KEY required")
            self._client = OpenAI(
                api_key=api_key,
                base_url="https://openrouter.ai/api/v1"
            )
        return self._client

    @property
    def model(self) -> str:
        from app.core.config import settings
        return settings.OPENROUTER_MODEL

    def _parse_llm_json(self, content: str, context: str = "LLM") -> Dict[str, Any]:
        """Robust JSON parsing for LLM responses."""
        import re

        if not content or content.strip() == "":
            raise ValueError(f"{context}: Empty response from LLM")

        content = content.strip()

        if "```" in content:
            code_block_match = re.search(r'```(?:json|JSON)?\s*\n?([\s\S]*?)\n?```', content)
            if code_block_match:
                content = code_block_match.group(1).strip()
            else:
                content = content.replace("```json", "").replace("```JSON", "").replace("```", "").strip()

        brace_idx = content.find('{')
        if brace_idx == -1:
            raise ValueError(f"{context}: No JSON object found in response")
        content = content[brace_idx:]

        try:
            return json.loads(content)
        except json.JSONDecodeError as e:
            if content.startswith('{'):
                depth = 0
                for i, char in enumerate(content):
                    if char == '{':
                        depth += 1
                    elif char == '}':
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(content[:i+1])
                            except json.JSONDecodeError:
                                break
            raise ValueError(f"{context}: Failed to parse JSON: {str(e)}")

    def _fetch_knowledge_base_context(
        self,
        db: Session,
        kb_ids: List[int],
        query: str,
        limit_per_kb: int = 10
    ) -> Dict[str, Any]:
        """Fetch relevant context from knowledge bases using semantic search."""
        if not kb_ids:
            return {"text": "", "metadata": []}

        context_parts = []
        metadata = []

        for kb_id in kb_ids:
            kb = db.get(KnowledgeBase, kb_id)
            if not kb or kb.status != "ready":
                continue

            try:
                from app.core.config import settings
                from openai import OpenAI as EmbeddingClient
                embed_client = EmbeddingClient(api_key=settings.OPENAI_API_KEY)
                embedding_response = embed_client.embeddings.create(
                    model=kb.settings.get("embeddingModel", "text-embedding-ada-002") if kb.settings else "text-embedding-ada-002",
                    input=query
                )
                query_embedding = embedding_response.data[0].embedding

                from sqlalchemy import text as sql_text
                results = db.execute(
                    sql_text("""
                        SELECT id, document_id, content, metadata_,
                               1 - (embedding <=> :embedding::vector) as similarity
                        FROM document_chunks
                        WHERE document_id IN (SELECT id FROM documents WHERE knowledge_base_id = :kb_id)
                        ORDER BY embedding <=> :embedding::vector
                        LIMIT :limit
                    """),
                    {"embedding": str(query_embedding), "kb_id": kb_id, "limit": limit_per_kb}
                ).fetchall()

                chunks_used = 0
                for row in results:
                    if row.similarity > 0.5:
                        context_parts.append(f"[From {kb.name}]\n{row.content}")
                        chunks_used += 1

                if chunks_used > 0:
                    metadata.append({
                        "id": kb_id,
                        "name": kb.name,
                        "chunks_used": chunks_used
                    })
            except Exception as e:
                print(f"Error fetching KB {kb_id} context: {e}")
                continue

        return {
            "text": "\n\n".join(context_parts),
            "metadata": metadata
        }

    # ==================== SESSION MANAGEMENT ====================

    def create_session(self, db: Session, data: MeasurementFrameworkSessionCreate, user_id: Optional[int] = None) -> MeasurementFrameworkSession:
        """Create a new measurement framework session."""
        session = MeasurementFrameworkSession(
            name=data.name,
            objectives_description=data.objectives_description,
            okr_session_id=data.okr_session_id,
            existing_data_sources=data.existing_data_sources,
            reporting_requirements=data.reporting_requirements,
            stakeholder_audience=data.stakeholder_audience,
            knowledge_base_ids=data.knowledge_base_ids,
            status="pending",
            user_id=user_id,
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        return session

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[MeasurementFrameworkSession]:
        """Get a session by ID, optionally filtered by user."""
        session = db.get(MeasurementFrameworkSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None  # User doesn't own this session
        return session

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20,
    ) -> List[MeasurementFrameworkSession]:
        """List sessions with pagination, filtered by user."""
        statement = select(MeasurementFrameworkSession)
        if user_id:
            statement = statement.where(MeasurementFrameworkSession.user_id == user_id)
        statement = statement.order_by(desc(MeasurementFrameworkSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session = db.get(MeasurementFrameworkSession, session_id)
        if not session:
            return False

        # Delete related data
        for metric in db.exec(select(FrameworkMetric).where(FrameworkMetric.session_id == session_id)).all():
            db.delete(metric)
        for source in db.exec(select(FrameworkDataSource).where(FrameworkDataSource.session_id == session_id)).all():
            db.delete(source)
        for dashboard in db.exec(select(FrameworkDashboard).where(FrameworkDashboard.session_id == session_id)).all():
            db.delete(dashboard)

        db.delete(session)
        db.commit()
        return True

    # ==================== AI GENERATION ====================

    def generate_framework(self, db: Session, session_id: int) -> MeasurementFrameworkSession:
        """Generate measurement framework using AI."""
        session = db.get(MeasurementFrameworkSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_message = "Building measurement framework..."
            session.updated_at = datetime.utcnow()
            db.commit()

            # Fetch knowledge base context if available
            kb_context = ""
            if session.knowledge_base_ids:
                session.progress_message = "Analyzing existing documentation..."
                db.commit()
                kb_result = self._fetch_knowledge_base_context(
                    db,
                    session.knowledge_base_ids,
                    f"analytics metrics data sources dashboards reporting measurement KPIs {session.objectives_description}",
                    limit_per_kb=15
                )
                kb_context = kb_result.get("text", "")

            prompt = self._build_framework_prompt(session, kb_context)

            from app.services.ai_config_service import ai_config_service
            model_name = ai_config_service.get_active_model(db)

            response = self.client.chat.completions.create(
                model=model_name,
                messages=[
                    {
                        "role": "system",
                        "content": """You are a JSON-only API for building measurement frameworks.

CRITICAL: You MUST respond with valid JSON only. No markdown, no explanations, no code fences.
Start your response with { and end with }. Your entire response must be parseable JSON.

Your expertise is in creating comprehensive measurement strategies with clear metrics, data sources, and dashboards."""
                    },
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=6000,
            )

            content = response.choices[0].message.content
            result = self._parse_llm_json(content, "Framework Generation")

            self._save_framework(db, session_id, result)

            session.status = "completed"
            session.executive_summary = result.get("executive_summary", "")
            session.framework_overview = result.get("framework_overview", "")
            session.completed_at = datetime.utcnow()
            session.updated_at = datetime.utcnow()
            session.progress_message = None
            db.commit()
            db.refresh(session)

            return session

        except Exception as e:
            session.status = "failed"
            session.error_message = str(e)
            session.updated_at = datetime.utcnow()
            db.commit()
            raise

    def _build_framework_prompt(self, session: MeasurementFrameworkSession, kb_context: str = "") -> str:
        """Build the prompt for framework generation."""
        kb_section = ""
        if kb_context:
            kb_section = f"""
## Existing Analytics Documentation
The following documentation from the organization's knowledge base describes existing analytics infrastructure,
data sources, and measurement practices. Use this information to ground your recommendations in reality -
reference actual data sources, existing dashboards, and current metrics where applicable:

{kb_context}

IMPORTANT: When recommending data sources and metrics, prioritize using existing infrastructure described above.
Only suggest new data sources when necessary. Make specific references to existing tools and systems.
"""

        prompt = f"""Create a comprehensive measurement framework based on the following requirements.

## Framework Name
{session.name}

## Objectives to Measure
{session.objectives_description}
{kb_section}
## Existing Data Sources
{session.existing_data_sources or "Not specified - recommend appropriate sources based on documentation above if available"}

## Reporting Requirements
{session.reporting_requirements or "Standard executive and operational reporting"}

## Stakeholder Audience
{session.stakeholder_audience or "Product team, engineering, and executives"}

## Instructions
Create a measurement framework that includes:
1. Metrics taxonomy (outcome, output, activity, input metrics)
2. Data sources with collection methods
3. Dashboard recommendations for different audiences

Respond with JSON in this exact format:
{{
    "executive_summary": "Brief summary of the measurement strategy",
    "framework_overview": "High-level description of the framework structure",
    "metrics": [
        {{
            "name": "Metric name",
            "description": "What this measures",
            "category": "outcome|output|activity|input",
            "metric_type": "quantitative|qualitative",
            "data_type": "percentage|count|ratio|score|currency",
            "formula": "Calculation formula if applicable",
            "unit": "Unit of measurement",
            "baseline": "Current or starting value",
            "target": "Target value",
            "threshold_good": "Value indicating good performance",
            "threshold_warning": "Value indicating warning",
            "threshold_critical": "Value indicating critical",
            "collection_method": "automated|manual|survey|api",
            "collection_frequency": "real-time|daily|weekly|monthly|quarterly",
            "data_owner": "Who owns this metric",
            "data_source": "Where data comes from",
            "visualization_type": "line|bar|gauge|table",
            "dashboard_placement": "executive|operational|tactical"
        }}
    ],
    "data_sources": [
        {{
            "name": "Source name",
            "source_type": "database|api|spreadsheet|survey|manual",
            "description": "What data this provides",
            "connection_details": "How to connect/access",
            "refresh_frequency": "real-time|hourly|daily|weekly",
            "reliability_score": "high|medium|low",
            "data_quality_notes": "Notes about data quality"
        }}
    ],
    "dashboards": [
        {{
            "name": "Dashboard name",
            "description": "Purpose of this dashboard",
            "audience": "executive|manager|team|individual",
            "purpose": "strategic|operational|tactical",
            "key_metrics": ["Metric 1", "Metric 2"],
            "layout_description": "How dashboard should be organized",
            "refresh_frequency": "real-time|daily|weekly",
            "recommended_tool": "PowerBI|Tableau|Custom|etc",
            "implementation_notes": "Implementation guidance"
        }}
    ]
}}"""
        return prompt

    def _save_framework(self, db: Session, session_id: int, result: Dict[str, Any]) -> None:
        """Save generated framework to database."""
        # Save metrics
        for i, m_data in enumerate(result.get("metrics", [])):
            metric = FrameworkMetric(
                session_id=session_id,
                name=m_data.get("name", ""),
                description=m_data.get("description", ""),
                category=m_data.get("category", "output"),
                metric_type=m_data.get("metric_type", "quantitative"),
                data_type=m_data.get("data_type", "number"),
                formula=m_data.get("formula"),
                unit=m_data.get("unit"),
                baseline=m_data.get("baseline"),
                target=m_data.get("target"),
                threshold_good=m_data.get("threshold_good"),
                threshold_warning=m_data.get("threshold_warning"),
                threshold_critical=m_data.get("threshold_critical"),
                collection_method=m_data.get("collection_method", "manual"),
                collection_frequency=m_data.get("collection_frequency", "weekly"),
                data_owner=m_data.get("data_owner"),
                data_source=m_data.get("data_source"),
                visualization_type=m_data.get("visualization_type"),
                dashboard_placement=m_data.get("dashboard_placement"),
                display_order=i,
            )
            db.add(metric)

        # Save data sources
        for j, ds_data in enumerate(result.get("data_sources", [])):
            data_source = FrameworkDataSource(
                session_id=session_id,
                name=ds_data.get("name", ""),
                source_type=ds_data.get("source_type", "manual"),
                description=ds_data.get("description", ""),
                connection_details=ds_data.get("connection_details"),
                refresh_frequency=ds_data.get("refresh_frequency", "daily"),
                reliability_score=ds_data.get("reliability_score"),
                data_quality_notes=ds_data.get("data_quality_notes"),
                display_order=j,
            )
            db.add(data_source)

        # Save dashboards
        for k, d_data in enumerate(result.get("dashboards", [])):
            dashboard = FrameworkDashboard(
                session_id=session_id,
                name=d_data.get("name", ""),
                description=d_data.get("description", ""),
                audience=d_data.get("audience", "team"),
                purpose=d_data.get("purpose", "operational"),
                key_metrics=d_data.get("key_metrics", []),
                layout_description=d_data.get("layout_description"),
                refresh_frequency=d_data.get("refresh_frequency", "daily"),
                recommended_tool=d_data.get("recommended_tool"),
                implementation_notes=d_data.get("implementation_notes"),
                display_order=k,
            )
            db.add(dashboard)

        db.commit()

    # ==================== DATA RETRIEVAL ====================

    def get_metrics(self, db: Session, session_id: int) -> List[FrameworkMetric]:
        """Get all metrics for a session."""
        statement = (
            select(FrameworkMetric)
            .where(FrameworkMetric.session_id == session_id)
            .order_by(FrameworkMetric.display_order)
        )
        return list(db.exec(statement).all())

    def get_data_sources(self, db: Session, session_id: int) -> List[FrameworkDataSource]:
        """Get all data sources for a session."""
        statement = (
            select(FrameworkDataSource)
            .where(FrameworkDataSource.session_id == session_id)
            .order_by(FrameworkDataSource.display_order)
        )
        return list(db.exec(statement).all())

    def get_dashboards(self, db: Session, session_id: int) -> List[FrameworkDashboard]:
        """Get all dashboards for a session."""
        statement = (
            select(FrameworkDashboard)
            .where(FrameworkDashboard.session_id == session_id)
            .order_by(FrameworkDashboard.display_order)
        )
        return list(db.exec(statement).all())

    def retry_session(self, db: Session, session_id: int) -> MeasurementFrameworkSession:
        """Retry a failed session."""
        session = db.get(MeasurementFrameworkSession, session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Clear existing data
        for metric in db.exec(select(FrameworkMetric).where(FrameworkMetric.session_id == session_id)).all():
            db.delete(metric)
        for source in db.exec(select(FrameworkDataSource).where(FrameworkDataSource.session_id == session_id)).all():
            db.delete(source)
        for dashboard in db.exec(select(FrameworkDashboard).where(FrameworkDashboard.session_id == session_id)).all():
            db.delete(dashboard)

        session.status = "pending"
        session.error_message = None
        session.executive_summary = None
        session.framework_overview = None
        session.completed_at = None
        session.updated_at = datetime.utcnow()
        db.commit()

        return self.generate_framework(db, session_id)
