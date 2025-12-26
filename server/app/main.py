from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from contextlib import asynccontextmanager
from app.core.db import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create/verify all database tables on startup
    print("=== Initializing database tables ===")
    try:
        create_db_and_tables()
        print("=== Database initialization complete ===")
    except Exception as e:
        print(f"=== Database initialization error: {e} ===")
        import traceback
        traceback.print_exc()

    for route in app.routes:
        print(f"Route: {route.path} {route.methods}")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    redirect_slashes=False,
    lifespan=lifespan
)

# Set all CORS enabled origins
if settings.all_cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/api/health")
def health_check():
    try:
        from sqlalchemy import create_engine, inspect, text
        from app.core.config import settings
        
        engine = create_engine(str(settings.DATABASE_URL))
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        
        # Check alembic version
        with engine.connect() as conn:
            try:
                result = conn.execute(text("SELECT version_num FROM alembic_version"))
                alembic_version = result.scalar()
            except:
                alembic_version = "not_found"
                
        return {
            "status": "ok", 
            "environment": "production",
            "tables": tables,
            "alembic_version": alembic_version,
            "feasibility_table_exists": "feasibility_sessions" in tables
        }
    except Exception as e:
        return {"status": "error", "detail": str(e)}

# Import and include routers here later
from app.api.api_v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
