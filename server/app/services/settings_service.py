from typing import Optional
from sqlmodel import Session, select
from cryptography.fernet import Fernet
from app.models.setting import SystemSetting
from app.core.config import settings

class SettingsService:
    def __init__(self):
        # Ensure we have a valid key, or fall back to a generated one for this session (wiping data on restart)
        # In prod, this must be persistent.
        key = settings.ENCRYPTION_KEY
        try:
            self.fernet = Fernet(key)
        except Exception:
            # Fallback if the key provided is garbage, mostly for dev fallback
            # This is dangerous for production persistence but fine for prototype stability
            print("Warning: Invalid ENCRYPTION_KEY, using temporary key.")
            self.fernet = Fernet(Fernet.generate_key())

    def set_setting(self, session: Session, key: str, value: str, description: str = None) -> SystemSetting:
        encrypted_val = self.fernet.encrypt(value.encode()).decode()
        
        setting = session.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
        if setting:
            setting.value = encrypted_val
            setting.description = description or setting.description
        else:
            setting = SystemSetting(key=key, value=encrypted_val, is_encrypted=True, description=description)
            session.add(setting)
        
        session.commit()
        session.refresh(setting)
        return setting

    def get_setting(self, session: Session, key: str) -> Optional[str]:
        setting = session.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
        if not setting:
            return None
            
        try:
            return self.fernet.decrypt(setting.value.encode()).decode()
        except Exception as e:
            print(f"Error decrypting setting {key}: {e}")
            return None

    def delete_setting(self, session: Session, key: str) -> bool:
        setting = session.exec(select(SystemSetting).where(SystemSetting.key == key)).first()
        if setting:
            session.delete(setting)
            session.commit()
            return True
        return False

settings_service = SettingsService()
