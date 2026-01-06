import os
from typing import List, Union, Optional
from pydantic import AnyHttpUrl, PostgresDsn, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_ignore_empty=True, extra="ignore")

    API_V1_STR: str = "/api"
    PROJECT_NAME: str = "ps-prototype-server"
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @computed_field
    @property
    def all_cors_origins(self) -> List[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + ["http://localhost:5173", "http://localhost:4200"]

    # Database
    DATABASE_URL: Union[PostgresDsn, str] = "postgresql://postgres:postgres@localhost:5432/ps_prototype"

    # AI Keys
    OPENAI_API_KEY: str = ""
    GOOGLE_API_KEY: str = ""
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_MODEL: str = "openai/gpt-oss-120b"

    # Security
    AUTH_ENABLED: str = "true"
    
    # Jira
    JIRA_CLIENT_ID: str = ""
    JIRA_CLIENT_SECRET: str = ""
    JIRA_REDIRECT_URI: str = "http://localhost:8000/api/integrations/jira/oauth/callback"
    
    # ADO
    ADO_CLIENT_ID: str = ""
    ADO_CLIENT_SECRET: str = ""
    ADO_REDIRECT_URI: str = "http://localhost:8000/api/integrations/ado/oauth/callback"

    # ServiceNow
    SERVICENOW_CLIENT_ID: str = ""
    SERVICENOW_CLIENT_SECRET: str = ""
    SERVICENOW_REDIRECT_URI: str = "http://localhost:8000/api/integrations/servicenow/oauth/callback"

    # Zendesk
    ZENDESK_CLIENT_ID: str = ""
    ZENDESK_CLIENT_SECRET: str = ""
    ZENDESK_REDIRECT_URI: str = "http://localhost:8000/api/integrations/zendesk/oauth/callback"

    # Qualtrics
    QUALTRICS_CLIENT_ID: str = ""
    QUALTRICS_CLIENT_SECRET: str = ""
    QUALTRICS_REDIRECT_URI: str = "http://localhost:8000/api/integrations/qualtrics/oauth/callback"

    GITHUB_WEBHOOK_SECRET: Optional[str] = None
    ENCRYPTION_KEY: str = "change_this_to_a_valid_fernet_key_in_production_XXXXXXXXXXXXXXXXXXXX="

settings = Settings()
