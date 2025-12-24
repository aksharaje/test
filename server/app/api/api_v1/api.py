from fastapi import APIRouter
from app.api.api_v1.endpoints import agents, knowledge_bases, code_chat, prd_generator, library, flows, feedback, placeholders, optimize, integrations, pi_planning, ideation, opportunity_linker, webhooks, feasibility, settings
from app.api.api_v1.endpoints.story_gen_endpoint import router as story_generator_router

api_router = APIRouter()
api_router.include_router(agents.router, prefix="/agents", tags=["agents"])
api_router.include_router(knowledge_bases.router, prefix="/knowledge-bases", tags=["knowledge-bases"])
api_router.include_router(story_generator_router, prefix="/story-generator", tags=["story-generator"])
api_router.include_router(code_chat.router, prefix="/code-chat", tags=["code-chat"])
api_router.include_router(prd_generator.router, prefix="/prd-generator", tags=["prd-generator"])
api_router.include_router(library.router, prefix="/library", tags=["library"])
api_router.include_router(flows.router, prefix="/flows", tags=["flows"])
api_router.include_router(feedback.router, prefix="/feedback", tags=["feedback"])
api_router.include_router(optimize.router, prefix="/optimize", tags=["optimize"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(pi_planning.router, prefix="/pi-planning", tags=["pi-planning"])
api_router.include_router(ideation.router, prefix="/ideation", tags=["ideation"])
api_router.include_router(opportunity_linker.router, prefix="/opportunity-linker", tags=["opportunity-linker"])
api_router.include_router(feasibility.router, prefix="/feasibility", tags=["feasibility"])
api_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(placeholders.router, prefix="", tags=["placeholders"])
