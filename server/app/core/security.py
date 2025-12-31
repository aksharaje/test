from datetime import datetime, timedelta
from typing import Any, Union, Optional
from jose import jwt
from passlib.context import CryptContext
import os
import hashlib

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "super_secret_key_change_in_production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # Short lived access token
MAGIC_LINK_EXPIRE_MINUTES = 15

# Debug: Print hash of secret key at startup
print(f"DEBUG SECURITY: SECRET_KEY hash = {hashlib.md5(SECRET_KEY.encode()).hexdigest()}")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"sub": str(subject), "exp": expire}
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_magic_link_token(email: str) -> str:
    # Just reusing JWT for magic link token for simplicity, but with different expiry
    expire = datetime.utcnow() + timedelta(minutes=MAGIC_LINK_EXPIRE_MINUTES)
    to_encode = {"sub": email, "type": "magic", "exp": expire}
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    print(f"DEBUG: Created magic token (first 50 chars): {token[:50]}...")
    print(f"DEBUG: Token length: {len(token)}")
    return token

def decode_token(token: str) -> Optional[dict]:
    print(f"DEBUG: Decoding token (first 50 chars): {token[:50] if len(token) > 50 else token}...")
    print(f"DEBUG: Token length: {len(token)}")
    try:
        # python-jose automatically validates expiry
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        print(f"DEBUG: Decoded successfully: {decoded_token}")
        return decoded_token
    except jwt.ExpiredSignatureError:
        print(f"DEBUG: Token expired (from jwt library)")
        return None
    except jwt.JWTError as e:
        print(f"DEBUG: JWT Decode Error: {e}")
        return None

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

