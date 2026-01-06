from typing import Optional
from sqlmodel import Session
from app.services.settings_service import settings_service
from app.core.config import settings

class AiConfigService:
    SETTING_KEY = "OPENROUTER_MODEL"

    def get_active_model(self, session: Session) -> str:
        """
        Get the currently active AI model from settings.
        Falls back to the environment variable if not set in DB.
        """
        db_setting = settings_service.get_setting(session, self.SETTING_KEY)
        if db_setting:
            return db_setting
        return settings.OPENROUTER_MODEL

    def set_active_model(self, session: Session, model: str) -> str:
        """
        Set the active AI model.
        """
        settings_service.set_setting(
            session, 
            self.SETTING_KEY, 
            model, 
            description="Active AI Model for OpenRouter calls"
        )
        return model

ai_config_service = AiConfigService()
