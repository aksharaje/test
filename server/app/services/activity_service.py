from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlmodel import Session, select, func, desc
from app.models.user_activity import UserActivity
# Artifact Models
from app.models.prd import GeneratedPrd
from app.models.ideation import IdeationSession
from app.models.feasibility import FeasibilitySession
from app.models.business_case import BusinessCaseSession
from app.models.journey_mapper import JourneyMapSession
from app.models.research_planner import ResearchPlanSession
from app.models.release_prep import ReleasePrepSession
from app.models.roadmap_planner import RoadmapSession
from app.models.story_to_code import StoryToCodeSession

class ActivityService:
    def log_activity(self, db: Session, user_id: int, feature_key: str, metadata: str = None) -> UserActivity:
        activity = UserActivity(
            user_id=user_id,
            feature_key=feature_key,
            metadata_json=metadata
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity

    def get_frequent_shortcuts(self, db: Session, user_id: int, limit: int = 4, days: int = 30) -> List[Dict[str, Any]]:
        """
        Get the most frequently used features in the last N days.
        Returns a list of dicts with feature details.
        """
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Query to count occurrences of each feature_key
        statement = (
            select(UserActivity.feature_key, func.count(UserActivity.id).label("count"))
            .where(UserActivity.user_id == user_id)
            .where(UserActivity.timestamp >= start_date)
            .group_by(UserActivity.feature_key)
            .order_by(desc("count"))
            .limit(limit)
        )
        
        results = db.exec(statement).all()
        
        shortcuts = []
        for feature_key, count in results:
            details = self._get_feature_details(feature_key)
            if details:
                shortcuts.append({
                    "id": feature_key,
                    "count": count,
                    **details
                })
        
        return shortcuts

    def _get_feature_details(self, feature_key: str) -> Dict[str, str]:
        """
        Map feature keys to UI details (Name, Icon, URL).
        """
        features = {
            "prd_generator": {
                "name": "PRD Generator",
                "icon": "lucideFileText",
                "url": "/prd-generator",
                "description": "Generate requirements docs"
            },
            "story_to_code": {
                "name": "Story to Code",
                "icon": "lucideCode",
                "url": "/story-to-code",
                "description": "Convert stories to code"
            },
            "cx_research": {
                "name": "CX Research",
                "icon": "lucideSearch",
                "url": "/cx/research-planner",
                "description": "Plan customer research"
            },
            "journey_mapper": {
                "name": "Journey Mapper",
                "icon": "lucideMap",
                "url": "/cx/journey-mapper",
                "description": "Visualize user journeys"
            },
             "experience_gap": {
                "name": "Gap Analyzer",
                "icon": "lucideTrendingDown", 
                "url": "/cx/gap-analyzer",
                "description": "Analyze experience gaps"
            },
            "ideation": {
                "name": "Ideation Service",
                "icon": "lucideLightbulb",
                "url": "/ideation",
                "description": "Brainstorm new features"
            },
            "business_case": {
                "name": "Business Case",
                "icon": "lucideBriefcase",
                "url": "/business-case",
                "description": "Build ROI cases"
            },
            "feasibility": {
                "name": "Feasibility Check",
                "icon": "lucideCheckCircle",
                "url": "/feasibility",
                "description": "Assess technical feasibility"
            },
             "release_prep": {
                "name": "Release Prep",
                "icon": "lucideRocket",
                "url": "/release-prep",
                "description": "Prepare release notes"
            },
             "roadmap_planner": {
                "name": "Roadmap Planner",
                "icon": "lucideCalendar",
                "url": "/roadmap-planner",
                "description": "Plan product roadmap"
            },
            "dashboard": {
                "name": "Dashboard",
                "icon": "lucideLayoutDashboard",
                "url": "/dashboard",
                "description": "Overview"
            }
        }
        return features.get(feature_key)

    def get_recent_outputs(self, db: Session, user_id: int, limit: int = 5) -> List[Dict[str, Any]]:
        """
        Aggregate recent outputs from all valid artifact tables.
        Returns a sorted list of standardized output objects.
        """
        outputs = []
        
        # Helper to query and format
        def query_model(model, type_key, title_field="title", url_prefix="", icon="lucideFile"):
            # Some models use 'updated_at', some rely on 'created_at' if updated not available
            # We assume all identified models have updated_at
            results = db.exec(
                select(model)
                .where(model.user_id == user_id)
                .order_by(desc(model.updated_at))
                .limit(limit)
            ).all()
            
            for item in results:
                title = getattr(item, title_field, "Untitled")
                # Handle edge cases like JourneyMapSession where title might be description
                if type_key == "journey_mapper":
                    title = getattr(item, "journey_description", "Untitled Journey")
                elif type_key == "research_planner":
                    title = getattr(item, "objective", "Untitled Research")
                elif type_key == "feasibility":
                    # Feasibility uses feature_description often
                    desc_text = getattr(item, "feature_description", "Untitled Feasibility")
                    title = desc_text[:50] + "..." if len(desc_text) > 50 else desc_text
                elif type_key == "roadmap_planner":
                    title = getattr(item, "name", "Untitled Roadmap")
                elif type_key == "release_prep":
                    title = getattr(item, "release_name", "Untitled Release")
                elif type_key == "business_case":
                    title = getattr(item, "feature_name", "Untitled Business Case")
                elif type_key == "ideation":
                    # Ideation session uses problem_statement
                    stmt = getattr(item, "problem_statement", "Untitled Ideation")
                    title = stmt[:50] + "..." if len(stmt) > 50 else stmt
                    
                outputs.append({
                    "id": item.id,
                    "type": type_key,
                    "title": title,
                    "updated_at": item.updated_at,
                    "url": f"{url_prefix}/{item.id}",
                    "icon": icon
                })

        # Query all sources
        query_model(GeneratedPrd, "prd", "title", "/prd-generator", "lucideFileText")
        query_model(IdeationSession, "ideation", "problem_statement", "/ideation", "lucideLightbulb")
        query_model(FeasibilitySession, "feasibility", "feature_description", "/feasibility", "lucideCheckCircle")
        query_model(BusinessCaseSession, "business_case", "feature_name", "/business-case", "lucideBriefcase")
        query_model(JourneyMapSession, "journey_mapper", "journey_description", "/cx/journey-mapper", "lucideMap")
        query_model(ResearchPlanSession, "research_planner", "objective", "/cx/research-planner", "lucideSearch")
        query_model(ReleasePrepSession, "release_prep", "release_name", "/release-prep", "lucideRocket")
        query_model(RoadmapSession, "roadmap_planner", "name", "/roadmap-planner", "lucideCalendar")
        query_model(StoryToCodeSession, "story_to_code", "title", "/story-to-code", "lucideCode")

        # Sort combined list by date desc
        outputs.sort(key=lambda x: x["updated_at"], reverse=True)
        
        # Return only top N
        return outputs[:limit]

activity_service = ActivityService()
