from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

from contextlib import asynccontextmanager
from app.core.db import create_db_and_tables

@asynccontextmanager
async def lifespan(app: FastAPI):
    # create_db_and_tables()
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
    return {"status": "ok"}

# Import and include routers here later
from app.api.api_v1.api import api_router
app.include_router(api_router, prefix=settings.API_V1_STR)
