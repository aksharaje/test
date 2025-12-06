from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

# Fix for "postgres://" scheme which SQLAlchemy doesn't support anymore (it wants "postgresql://")
database_url = str(settings.DATABASE_URL)
if database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(database_url)

def get_session():
    with Session(engine) as session:
        yield session

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)
