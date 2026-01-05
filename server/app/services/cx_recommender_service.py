"""
CX Improvement Recommender Service

Multi-stage LLM pipeline for generating prioritized improvement recommendations
from journey map pain points and competitive gap analysis.

Pipeline Stages:
1. Extract - Pull pain points from journey maps, gaps from analyses
2. Cluster - Group related issues into thematic clusters
3. Generate - Create recommendations for each cluster
4. Score - Calculate impact, effort, and opportunity scores
5. Prioritize - Tier and categorize recommendations
"""
import json
import time
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlmodel import Session, select, desc
from humps import camelize

from app.models.cx_recommender import (
    RecommenderSession,
    Recommendation,
    RecommenderInputCache
)
from app.models.journey_mapper import JourneyMapSession, JourneyPainPoint
from app.models.experience_gap_analyzer import GapAnalysisSession, GapItem
from app.services.llm_json_utils import get_strict_json_llm, create_json_prompt


def _camelize_nested(obj: Any) -> Any:
    """Recursively convert all dict keys from snake_case to camelCase."""
    if isinstance(obj, dict):
        return {camelize(k): _camelize_nested(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_camelize_nested(item) for item in obj]
    return obj


class CXRecommenderService:
    """Service for generating CX improvement recommendations"""

    def __init__(self):
        self._llm = None

    @property
    def llm(self):
        """Get the strict JSON LLM instance."""
        if self._llm is None:
            self._llm = get_strict_json_llm()
        return self._llm

    def _calculate_opportunity_score(self, impact: float, urgency: float, effort: float) -> float:
        """Calculate opportunity score: (Impact × Urgency) / Effort"""
        if effort <= 0:
            effort = 1.0
        return round((impact * urgency) / effort, 2)

    def _calculate_priority_tier(self, opportunity_score: float) -> int:
        """Determine priority tier based on opportunity score."""
        if opportunity_score > 15:
            return 1  # Critical
        elif opportunity_score >= 8:
            return 2  # Important
        else:
            return 3  # Strategic

    def _is_quick_win(self, impact: float, effort: float) -> bool:
        """Check if recommendation qualifies as a quick win."""
        return impact > 7.0 and effort < 4.0

    def _get_display_category(self, quick_win: bool, priority_tier: int, effort: float) -> str:
        """Determine display category for three-column layout."""
        if quick_win:
            return "quick_wins"
        elif priority_tier <= 2 and effort <= 7:
            return "high_impact"
        else:
            return "strategic"

    # --- Session Management ---

    def create_session(
        self,
        db: Session,
        journey_map_ids: List[int],
        gap_analysis_ids: Optional[List[int]] = None,
        idea_backlog_ids: Optional[List[int]] = None,
        timeline: str = "flexible",
        budget: str = "flexible",
        team_capacity: Optional[str] = None,
        recommendation_type: str = "comprehensive",
        session_name: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> RecommenderSession:
        """Create a new recommender session."""
        if not journey_map_ids and not gap_analysis_ids:
            raise ValueError("At least one journey map or gap analysis is required")

        # Validate journey maps exist and are completed
        for jm_id in (journey_map_ids or []):
            jm = db.get(JourneyMapSession, jm_id)
            if not jm:
                raise ValueError(f"Journey map {jm_id} not found")
            if jm.status != "completed":
                raise ValueError(f"Journey map {jm_id} must be completed")

        # Validate gap analyses exist and are completed
        for ga_id in (gap_analysis_ids or []):
            ga = db.get(GapAnalysisSession, ga_id)
            if not ga:
                raise ValueError(f"Gap analysis {ga_id} not found")
            if ga.status != "completed":
                raise ValueError(f"Gap analysis {ga_id} must be completed")

        session_obj = RecommenderSession(
            user_id=user_id,
            session_name=session_name or f"Recommendations {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
            journey_map_ids=journey_map_ids or [],
            gap_analysis_ids=gap_analysis_ids or [],
            idea_backlog_ids=idea_backlog_ids or [],
            timeline=timeline,
            budget=budget,
            team_capacity=team_capacity,
            recommendation_type=recommendation_type,
            status="pending",
            progress_step=0,
            progress_message="Initializing recommendation generation..."
        )
        db.add(session_obj)
        db.commit()
        db.refresh(session_obj)

        return session_obj

    def get_session(self, db: Session, session_id: int, user_id: Optional[int] = None) -> Optional[RecommenderSession]:
        """Get a session by ID, optionally filtered by user_id."""
        session = db.get(RecommenderSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def list_sessions(
        self,
        db: Session,
        user_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 20
    ) -> List[RecommenderSession]:
        """List all sessions, optionally filtered by user."""
        statement = select(RecommenderSession)
        if user_id:
            statement = statement.where(RecommenderSession.user_id == user_id)
        statement = statement.order_by(desc(RecommenderSession.created_at)).offset(skip).limit(limit)
        return list(db.exec(statement).all())

    def get_session_detail(self, db: Session, session_id: int) -> Optional[Dict[str, Any]]:
        """Get complete session detail with all recommendations."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return None

        # Fetch recommendations by category
        all_recs = list(db.exec(
            select(Recommendation)
            .where(Recommendation.session_id == session_id)
            .where(Recommendation.is_dismissed == False)
            .order_by(desc(Recommendation.opportunity_score))
        ).all())

        quick_wins = [r for r in all_recs if r.display_category == "quick_wins"]
        high_impact = [r for r in all_recs if r.display_category == "high_impact"]
        strategic = [r for r in all_recs if r.display_category == "strategic"]

        return {
            "session": _camelize_nested(session_obj.model_dump()),
            "recommendations": {
                "quickWins": [_camelize_nested(r.model_dump()) for r in quick_wins],
                "highImpact": [_camelize_nested(r.model_dump()) for r in high_impact],
                "strategic": [_camelize_nested(r.model_dump()) for r in strategic]
            },
            "totals": {
                "quickWins": len(quick_wins),
                "highImpact": len(high_impact),
                "strategic": len(strategic),
                "total": len(all_recs)
            }
        }

    def delete_session(self, db: Session, session_id: int) -> bool:
        """Delete a session and all related data."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return False

        # Delete related data
        for rec in db.exec(select(Recommendation).where(Recommendation.session_id == session_id)):
            db.delete(rec)
        for cache in db.exec(select(RecommenderInputCache).where(RecommenderInputCache.session_id == session_id)):
            db.delete(cache)

        db.delete(session_obj)
        db.commit()
        return True

    # --- Recommendation Management ---

    def get_recommendation(self, db: Session, rec_id: int) -> Optional[Recommendation]:
        """Get a single recommendation by ID."""
        return db.get(Recommendation, rec_id)

    def update_recommendation(
        self,
        db: Session,
        rec_id: int,
        updates: Dict[str, Any]
    ) -> Optional[Recommendation]:
        """Update a recommendation (user edits)."""
        rec = db.get(Recommendation, rec_id)
        if not rec:
            return None

        # Apply updates
        if "title" in updates:
            rec.title = updates["title"]
        if "description" in updates:
            rec.description = updates["description"]
        if "impact_score" in updates:
            rec.impact_score = float(updates["impact_score"])
        if "effort_score" in updates:
            rec.effort_score = float(updates["effort_score"])
        if "urgency_score" in updates:
            rec.urgency_score = float(updates["urgency_score"])
        if "implementation_approach" in updates:
            rec.implementation_approach = updates["implementation_approach"]
        if "success_metrics" in updates:
            rec.success_metrics = updates["success_metrics"]
        if "status" in updates:
            rec.status = updates["status"]

        # Recalculate derived fields
        rec.opportunity_score = self._calculate_opportunity_score(
            rec.impact_score, rec.urgency_score, rec.effort_score
        )
        rec.priority_tier = self._calculate_priority_tier(rec.opportunity_score)
        rec.quick_win = self._is_quick_win(rec.impact_score, rec.effort_score)
        rec.display_category = self._get_display_category(
            rec.quick_win, rec.priority_tier, rec.effort_score
        )

        rec.is_user_edited = True
        rec.updated_at = datetime.utcnow()

        db.add(rec)
        db.commit()
        db.refresh(rec)

        # Update session counts
        self._update_session_counts(db, rec.session_id)

        return rec

    def dismiss_recommendation(self, db: Session, rec_id: int) -> bool:
        """Dismiss (soft delete) a recommendation."""
        rec = db.get(Recommendation, rec_id)
        if not rec:
            return False

        rec.is_dismissed = True
        rec.status = "dismissed"
        rec.updated_at = datetime.utcnow()
        db.add(rec)
        db.commit()

        self._update_session_counts(db, rec.session_id)
        return True

    def restore_recommendation(self, db: Session, rec_id: int) -> Optional[Recommendation]:
        """Restore a dismissed recommendation."""
        rec = db.get(Recommendation, rec_id)
        if not rec:
            return None

        rec.is_dismissed = False
        rec.status = "proposed"
        rec.updated_at = datetime.utcnow()
        db.add(rec)
        db.commit()
        db.refresh(rec)

        self._update_session_counts(db, rec.session_id)
        return rec

    def add_custom_recommendation(
        self,
        db: Session,
        session_id: int,
        title: str,
        description: str,
        impact_score: float = 5.0,
        effort_score: float = 5.0,
        urgency_score: float = 5.0,
        implementation_approach: Optional[str] = None,
        success_metrics: Optional[List[str]] = None
    ) -> Recommendation:
        """Manually add a custom recommendation."""
        opportunity_score = self._calculate_opportunity_score(impact_score, urgency_score, effort_score)
        priority_tier = self._calculate_priority_tier(opportunity_score)
        quick_win = self._is_quick_win(impact_score, effort_score)
        display_category = self._get_display_category(quick_win, priority_tier, effort_score)

        rec = Recommendation(
            session_id=session_id,
            title=title,
            description=description,
            impact_score=impact_score,
            effort_score=effort_score,
            urgency_score=urgency_score,
            opportunity_score=opportunity_score,
            priority_tier=priority_tier,
            quick_win=quick_win,
            display_category=display_category,
            implementation_approach=implementation_approach,
            success_metrics=success_metrics or [],
            is_custom=True,
            is_user_edited=True
        )
        db.add(rec)
        db.commit()
        db.refresh(rec)

        self._update_session_counts(db, session_id)
        return rec

    def _update_session_counts(self, db: Session, session_id: int):
        """Update recommendation counts on session."""
        session_obj = self.get_session(db, session_id)
        if not session_obj:
            return

        recs = list(db.exec(
            select(Recommendation)
            .where(Recommendation.session_id == session_id)
            .where(Recommendation.is_dismissed == False)
        ).all())

        session_obj.total_recommendations = len(recs)
        session_obj.quick_wins_count = sum(1 for r in recs if r.display_category == "quick_wins")
        session_obj.high_impact_count = sum(1 for r in recs if r.display_category == "high_impact")
        session_obj.strategic_count = sum(1 for r in recs if r.display_category == "strategic")
        session_obj.updated_at = datetime.utcnow()

        db.add(session_obj)
        db.commit()

    # --- Progress Updates ---

    def _update_progress(
        self,
        db: Session,
        session_id: int,
        status: str,
        step: int,
        message: Optional[str] = None,
        error_message: Optional[str] = None
    ):
        """Update session progress."""
        session_obj = self.get_session(db, session_id)
        if session_obj:
            session_obj.status = status
            session_obj.progress_step = step
            if message:
                session_obj.progress_message = message
            if error_message:
                session_obj.error_message = error_message
            session_obj.updated_at = datetime.utcnow()
            db.add(session_obj)
            db.commit()

    # --- Main Pipeline ---

    def run_recommendation_pipeline(self, db: Session, session_id: int):
        """Main pipeline for generating recommendations. Runs in background task."""
        start_time = time.time()

        try:
            session_obj = self.get_session(db, session_id)
            if not session_obj:
                raise ValueError("Session not found")

            # Stage 1: Extract data from sources
            self._update_progress(db, session_id, "extracting", 1, "Extracting pain points and gaps...")
            extracted_data = self._stage_extract(db, session_obj)

            if not extracted_data["pain_points"] and not extracted_data["gaps"]:
                raise ValueError("No pain points or gaps found in selected sources")

            # Stage 2: Cluster related issues
            self._update_progress(db, session_id, "clustering", 2, "Clustering related issues...")
            clusters = self._stage_cluster(db, session_id, extracted_data)

            # Stage 3: Generate recommendations
            self._update_progress(db, session_id, "generating", 3, "Generating improvement recommendations...")
            recommendations = self._stage_generate(db, session_id, clusters, extracted_data, session_obj)

            # Stage 4: Score and prioritize
            self._update_progress(db, session_id, "scoring", 4, "Scoring impact and effort...")
            scored_recs = self._stage_score(db, session_id, recommendations, session_obj)

            # Stage 5: Apply constraints and categorize
            self._update_progress(db, session_id, "scoring", 5, "Applying constraints and categorizing...")
            final_recs = self._stage_prioritize(db, session_id, scored_recs, session_obj)

            # Stage 6: Generate sprint plan
            self._update_progress(db, session_id, "scoring", 6, "Generating sprint plan suggestion...")
            self._stage_sprint_plan(db, session_id, final_recs, session_obj)

            # Mark completed
            session_obj = self.get_session(db, session_id)
            session_obj.status = "completed"
            session_obj.completed_at = datetime.utcnow()
            session_obj.progress_message = f"Generated {session_obj.total_recommendations} recommendations!"
            db.add(session_obj)
            db.commit()

            print(f"Recommendation pipeline completed in {time.time() - start_time:.2f}s")

        except Exception as e:
            print(f"ERROR in recommendation pipeline: {str(e)}")
            import traceback
            traceback.print_exc()
            self._update_progress(db, session_id, "failed", 0, None, error_message=str(e))
            raise

    # --- Pipeline Stages ---

    def _stage_extract(self, db: Session, session_obj: RecommenderSession) -> Dict[str, Any]:
        """Stage 1: Extract pain points from journey maps, gaps from analyses."""
        pain_points = []
        gaps = []
        ideas = []

        # Extract pain points from journey maps
        for jm_id in (session_obj.journey_map_ids or []):
            journey = db.get(JourneyMapSession, jm_id)
            if not journey:
                continue

            # Get pain points
            pps = list(db.exec(
                select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == jm_id)
            ).all())

            # Get stage names for context
            stages_by_id = {}
            if journey.stages:
                for s in journey.stages:
                    stages_by_id[s.get("id", "")] = s.get("name", "Unknown Stage")

            for pp in pps:
                pain_points.append({
                    "id": pp.id,
                    "journey_map_id": jm_id,
                    "description": pp.description,
                    "severity": pp.severity,
                    "frequency": pp.frequency,
                    "stage_id": pp.stage_id,
                    "stage_name": stages_by_id.get(pp.stage_id, "Unknown Stage"),
                    "data_sources": pp.data_sources or []
                })

        # Extract gaps from gap analyses
        for ga_id in (session_obj.gap_analysis_ids or []):
            gap_analysis = db.get(GapAnalysisSession, ga_id)
            if not gap_analysis:
                continue

            gap_items = list(db.exec(
                select(GapItem).where(GapItem.session_id == ga_id)
            ).all())

            for gap in gap_items:
                gaps.append({
                    "id": gap.id,
                    "session_id": ga_id,
                    "title": gap.title,
                    "description": gap.description,
                    "category": gap.category,
                    "stage_id": gap.stage_id,
                    "stage_name": gap.stage_name,
                    "impact_score": gap.impact_score,
                    "urgency_score": gap.urgency_score,
                    "effort_score": gap.effort_score,
                    "opportunity_score": gap.opportunity_score,
                    "evidence": gap.evidence,
                    "comparison_notes": gap.comparison_notes
                })

        # Cache extracted data
        cache = RecommenderInputCache(
            session_id=session_obj.id,
            extracted_pain_points=pain_points,
            extracted_gaps=gaps,
            extracted_ideas=ideas,
            total_pain_points=len(pain_points),
            total_gaps=len(gaps),
            total_ideas=len(ideas)
        )
        db.add(cache)
        db.commit()

        return {
            "pain_points": pain_points,
            "gaps": gaps,
            "ideas": ideas
        }

    def _stage_cluster(
        self,
        db: Session,
        session_id: int,
        extracted_data: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Stage 2: Cluster related pain points and gaps into thematic groups."""
        pain_points = extracted_data["pain_points"]
        gaps = extracted_data["gaps"]

        if not pain_points and not gaps:
            return []

        # Prepare data for LLM
        pp_summary = [{"id": pp["id"], "description": pp["description"], "severity": pp["severity"], "stage": pp["stage_name"]} for pp in pain_points]
        gap_summary = [{"id": g["id"], "title": g["title"], "description": g["description"], "stage": g.get("stage_name", "")} for g in gaps]

        # Build strict JSON prompt
        prompt = create_json_prompt(
            task_description=f"""Cluster these pain points and gaps into thematic groups.

PAIN POINTS ({len(pain_points)} total):
{json.dumps(pp_summary, indent=2)}

GAPS ({len(gaps)} total):
{json.dumps(gap_summary, indent=2)}

GROUP related items that address the SAME underlying issue. For example:
- "SSO setup confusing" pain point + "SSO auto-detect missing" gap = same root issue about SSO experience""",
            json_schema={
                "clusters": [
                    {
                        "id": "cluster_1 (string, unique identifier)",
                        "name": "SSO Setup Experience (string, action-oriented name)",
                        "theme": "Simplify and automate SSO configuration (string, brief theme description)",
                        "pain_point_ids": [1, 5, "(array of pain point IDs from input)"],
                        "gap_ids": [2, "(array of gap IDs from input)"],
                        "combined_severity": 7.5
                    }
                ]
            },
            additional_rules=[
                "Each pain point and gap must appear in exactly ONE cluster",
                f"Create 3-{min(15, len(pain_points) + len(gaps))} clusters based on thematic similarity",
                "Name clusters with action-oriented phrases",
                "combined_severity = average severity of items in cluster (number 1-10)",
                "Include ALL pain_point_ids and gap_ids from input data"
            ]
        )

        # Call LLM with strict JSON enforcement
        data = self.llm.call(
            prompt=prompt,
            context="Clustering",
            temperature=0.3,
            max_tokens=4000,
            required_keys=["clusters"],
            fallback_value={"clusters": self._fallback_clustering(pain_points, gaps)}
        )

        clusters = data.get("clusters", [])

        # Validate we got clusters
        if not clusters:
            print("WARNING: LLM returned empty clusters, using fallback")
            clusters = self._fallback_clustering(pain_points, gaps)

        # Store clusters in session
        session_obj = self.get_session(db, session_id)
        session_obj.clusters = clusters
        db.add(session_obj)
        db.commit()

        return clusters

    def _fallback_clustering(self, pain_points: List[Dict], gaps: List[Dict]) -> List[Dict[str, Any]]:
        """Create simple fallback clusters when LLM fails.

        Groups items by their stage/category to ensure recommendations can still be generated.
        """
        clusters = []

        # Group by stage
        stages = {}
        for pp in pain_points:
            stage = pp.get("stage_name", "General")
            if stage not in stages:
                stages[stage] = {"pain_point_ids": [], "gap_ids": [], "severities": []}
            stages[stage]["pain_point_ids"].append(pp["id"])
            stages[stage]["severities"].append(pp.get("severity", 5.0))

        for gap in gaps:
            stage = gap.get("stage_name", "General")
            if stage not in stages:
                stages[stage] = {"pain_point_ids": [], "gap_ids": [], "severities": []}
            stages[stage]["gap_ids"].append(gap["id"])
            stages[stage]["severities"].append(gap.get("impact_score", 5.0))

        # Create cluster for each stage
        for i, (stage, data) in enumerate(stages.items(), 1):
            avg_severity = sum(data["severities"]) / len(data["severities"]) if data["severities"] else 5.0
            clusters.append({
                "id": f"cluster_{i}",
                "name": f"Improve {stage} Experience",
                "theme": f"Address issues in the {stage} stage",
                "pain_point_ids": data["pain_point_ids"],
                "gap_ids": data["gap_ids"],
                "combined_severity": round(avg_severity, 1)
            })

        return clusters

    def _stage_generate(
        self,
        db: Session,
        session_id: int,
        clusters: List[Dict[str, Any]],
        extracted_data: Dict[str, Any],
        session_obj: RecommenderSession
    ) -> List[Dict[str, Any]]:
        """Stage 3: Generate recommendations for each cluster."""
        pain_points_by_id = {pp["id"]: pp for pp in extracted_data["pain_points"]}
        gaps_by_id = {g["id"]: g for g in extracted_data["gaps"]}

        all_recommendations = []

        # Build cluster context
        cluster_contexts = []
        for cluster in clusters:
            cluster_pps = [pain_points_by_id[pid] for pid in cluster.get("pain_point_ids", []) if pid in pain_points_by_id]
            cluster_gaps = [gaps_by_id[gid] for gid in cluster.get("gap_ids", []) if gid in gaps_by_id]

            cluster_contexts.append({
                "cluster_id": cluster.get("id"),
                "name": cluster.get("name"),
                "theme": cluster.get("theme"),
                "pain_points": cluster_pps,
                "gaps": cluster_gaps
            })

        # Generate recommendations in batches
        rec_type = session_obj.recommendation_type
        rec_type_instruction = ""
        if rec_type == "quick_wins":
            rec_type_instruction = "Focus on high-impact, low-effort solutions that can be implemented quickly."
        elif rec_type == "strategic":
            rec_type_instruction = "Focus on transformative, long-term improvements even if they require significant effort."
        elif rec_type == "parity":
            rec_type_instruction = "Focus on closing competitive gaps. Each recommendation should directly address a gap."

        # Build strict JSON prompt for recommendation generation
        prompt = create_json_prompt(
            task_description=f"""Generate improvement recommendations for each cluster.

CLUSTERS AND THEIR ISSUES:
{json.dumps(cluster_contexts, indent=2)}

{rec_type_instruction}

For each cluster, generate ONE recommendation addressing the pain points and gaps in that cluster.""",
            json_schema={
                "recommendations": [
                    {
                        "cluster_id": "cluster_1 (string, must match a cluster id from input)",
                        "title": "Implement SSO Auto-Detection (string, action-oriented title)",
                        "description": "Automatically detect user's identity provider during signup to reduce configuration friction. (string, 2-3 sentences)",
                        "solution_approaches": [
                            {
                                "title": "Approach name (string)",
                                "description": "How this approach works (string)",
                                "pros": ["Benefit 1", "Benefit 2"],
                                "cons": ["Drawback 1"]
                            }
                        ],
                        "implementation_approach": "How to build this recommendation (string)",
                        "success_metrics": ["Metric 1", "Metric 2", "Metric 3"]
                    }
                ]
            },
            additional_rules=[
                f"Generate exactly {len(cluster_contexts)} recommendations (one per cluster)",
                "Each recommendation must have 2-3 solution_approaches",
                "Each recommendation must have 3-5 success_metrics",
                "Titles should be action-oriented (e.g., 'Implement...', 'Add...', 'Improve...')",
                "cluster_id must exactly match the cluster IDs from the input"
            ]
        )

        # Call LLM with strict JSON enforcement
        data = self.llm.call(
            prompt=prompt,
            context="Recommendation Generation",
            temperature=0.4,
            max_tokens=8000,
            required_keys=["recommendations"]
        )

        recommendations = data.get("recommendations", [])

        # Enrich recommendations with source data linkages
        for rec in recommendations:
            cluster_id = rec.get("cluster_id")
            cluster = next((c for c in clusters if c.get("id") == cluster_id), None)

            if cluster:
                # Add linked pain points
                pp_ids = cluster.get("pain_point_ids", [])
                rec["addresses_pain_points"] = [
                    {
                        "pain_point_id": pid,
                        "description": pain_points_by_id[pid]["description"],
                        "severity": pain_points_by_id[pid]["severity"],
                        "stage_name": pain_points_by_id[pid]["stage_name"]
                    }
                    for pid in pp_ids if pid in pain_points_by_id
                ]

                # Add linked gaps
                gap_ids = cluster.get("gap_ids", [])
                rec["addresses_gaps"] = [
                    {
                        "gap_id": gid,
                        "title": gaps_by_id[gid]["title"],
                        "opportunity_score": gaps_by_id[gid]["opportunity_score"]
                    }
                    for gid in gap_ids if gid in gaps_by_id
                ]

            all_recommendations.append(rec)

        return all_recommendations

    def _stage_score(
        self,
        db: Session,
        session_id: int,
        recommendations: List[Dict[str, Any]],
        session_obj: RecommenderSession
    ) -> List[Dict[str, Any]]:
        """Stage 4: Score impact and effort for each recommendation."""
        # Prepare for scoring
        recs_for_scoring = []
        for rec in recommendations:
            # Calculate base scores from linked items
            avg_severity = 5.0
            if rec.get("addresses_pain_points"):
                avg_severity = sum(pp["severity"] for pp in rec["addresses_pain_points"]) / len(rec["addresses_pain_points"])

            avg_gap_score = 5.0
            if rec.get("addresses_gaps"):
                avg_gap_score = sum(g["opportunity_score"] for g in rec["addresses_gaps"]) / len(rec["addresses_gaps"])

            recs_for_scoring.append({
                "title": rec.get("title"),
                "description": rec.get("description"),
                "implementation_approach": rec.get("implementation_approach"),
                "pain_point_count": len(rec.get("addresses_pain_points", [])),
                "gap_count": len(rec.get("addresses_gaps", [])),
                "avg_pain_severity": round(avg_severity, 1),
                "avg_gap_opportunity": round(avg_gap_score, 1)
            })

        # Build strict JSON prompt for scoring
        prompt = create_json_prompt(
            task_description=f"""Score these improvement recommendations for Impact, Effort, and Urgency.

RECOMMENDATIONS TO SCORE:
{json.dumps(recs_for_scoring, indent=2)}

TEAM CAPACITY: {session_obj.team_capacity or "Not specified"}

Score each recommendation based on its description and the context provided.""",
            json_schema={
                "scored_recommendations": [
                    {
                        "title": "Exact title from input (string, must match exactly)",
                        "impact_score": 8.5,
                        "effort_score": 4.0,
                        "urgency_score": 7.0,
                        "design_days": 3,
                        "engineering_days": 10,
                        "testing_days": 3,
                        "risk_level": "medium (string: 'low', 'medium', or 'high')",
                        "pain_reduction_percent": 35,
                        "users_affected_percent": 40,
                        "business_metrics": {
                            "time_savings": "50% reduction in setup time",
                            "conversion_lift": "+5% signup completion",
                            "nps_impact": "+10 NPS points"
                        }
                    }
                ]
            },
            additional_rules=[
                f"Score exactly {len(recs_for_scoring)} recommendations (match all titles from input)",
                "impact_score: 1-10 based on pain severity, users affected, business value",
                "effort_score: 1-10 based on implementation complexity (1=easy, 10=very hard)",
                "urgency_score: 1-10 based on competitive pressure and pain frequency",
                "design_days, engineering_days, testing_days: integer estimates",
                "risk_level: must be exactly 'low', 'medium', or 'high'",
                "pain_reduction_percent and users_affected_percent: integers 0-100",
                "Title must EXACTLY match the input title for matching"
            ]
        )

        # Call LLM with strict JSON enforcement
        data = self.llm.call(
            prompt=prompt,
            context="Impact/Effort Scoring",
            temperature=0.3,
            max_tokens=6000,
            required_keys=["scored_recommendations"]
        )

        scores = data.get("scored_recommendations", [])
        scores_by_title = {s["title"]: s for s in scores}

        # Merge scores into recommendations
        for rec in recommendations:
            title = rec.get("title")
            if title in scores_by_title:
                score_data = scores_by_title[title]
                rec["impact_score"] = float(score_data.get("impact_score", 5.0))
                rec["effort_score"] = float(score_data.get("effort_score", 5.0))
                rec["urgency_score"] = float(score_data.get("urgency_score", 5.0))
                rec["design_days"] = score_data.get("design_days")
                rec["engineering_days"] = score_data.get("engineering_days")
                rec["testing_days"] = score_data.get("testing_days")
                rec["risk_level"] = score_data.get("risk_level", "medium")
                rec["pain_reduction_percent"] = score_data.get("pain_reduction_percent")
                rec["users_affected_percent"] = score_data.get("users_affected_percent")
                rec["business_metrics"] = score_data.get("business_metrics")

                # Calculate total effort days
                rec["total_effort_days"] = sum(filter(None, [
                    rec.get("design_days"),
                    rec.get("engineering_days"),
                    rec.get("testing_days")
                ]))

        return recommendations

    def _stage_prioritize(
        self,
        db: Session,
        session_id: int,
        recommendations: List[Dict[str, Any]],
        session_obj: RecommenderSession
    ) -> List[Recommendation]:
        """Stage 5: Apply constraints, calculate opportunity scores, categorize."""
        final_recs = []

        # Parse timeline constraint to max weeks
        max_weeks = None
        timeline = session_obj.timeline
        if timeline == "Q1 2025":
            max_weeks = 12
        elif timeline == "Q2 2025":
            max_weeks = 24
        elif timeline == "H1 2025":
            max_weeks = 26
        elif timeline == "H2 2025":
            max_weeks = 52

        for rec_data in recommendations:
            impact = float(rec_data.get("impact_score", 5.0))
            effort = float(rec_data.get("effort_score", 5.0))
            urgency = float(rec_data.get("urgency_score", 5.0))

            # Calculate opportunity score
            opportunity_score = self._calculate_opportunity_score(impact, urgency, effort)
            priority_tier = self._calculate_priority_tier(opportunity_score)
            quick_win = self._is_quick_win(impact, effort)
            display_category = self._get_display_category(quick_win, priority_tier, effort)

            # Apply recommendation type filter
            rec_type = session_obj.recommendation_type
            if rec_type == "quick_wins" and not quick_win:
                continue
            if rec_type == "strategic" and effort < 7:
                continue
            if rec_type == "parity" and not rec_data.get("addresses_gaps"):
                continue

            # Apply timeline constraint
            total_days = rec_data.get("total_effort_days", 0)
            if max_weeks and total_days > max_weeks * 5:  # 5 work days per week
                continue

            # Create database record
            rec = Recommendation(
                session_id=session_id,
                title=rec_data.get("title", "Untitled"),
                description=rec_data.get("description", ""),
                cluster_id=rec_data.get("cluster_id"),
                solution_approaches=rec_data.get("solution_approaches"),
                addresses_pain_points=rec_data.get("addresses_pain_points"),
                addresses_gaps=rec_data.get("addresses_gaps"),
                impact_score=impact,
                effort_score=effort,
                urgency_score=urgency,
                opportunity_score=opportunity_score,
                priority_tier=priority_tier,
                quick_win=quick_win,
                display_category=display_category,
                pain_reduction_percent=rec_data.get("pain_reduction_percent"),
                users_affected_percent=rec_data.get("users_affected_percent"),
                business_metrics=rec_data.get("business_metrics"),
                design_days=rec_data.get("design_days"),
                engineering_days=rec_data.get("engineering_days"),
                testing_days=rec_data.get("testing_days"),
                total_effort_days=rec_data.get("total_effort_days"),
                risk_level=rec_data.get("risk_level", "medium"),
                implementation_approach=rec_data.get("implementation_approach"),
                success_metrics=rec_data.get("success_metrics", []),
                competitive_context=rec_data.get("competitive_context")
            )
            db.add(rec)
            final_recs.append(rec)

        db.commit()

        # Update session counts
        self._update_session_counts(db, session_id)

        return final_recs

    def _stage_sprint_plan(
        self,
        db: Session,
        session_id: int,
        recommendations: List[Recommendation],
        session_obj: RecommenderSession
    ):
        """Stage 6: Generate suggested sprint plan."""
        # Get active recommendations
        active_recs = [r for r in recommendations if not r.is_dismissed]

        # Sort by category and opportunity score
        quick_wins = sorted(
            [r for r in active_recs if r.display_category == "quick_wins"],
            key=lambda x: -x.opportunity_score
        )
        high_impact = sorted(
            [r for r in active_recs if r.display_category == "high_impact"],
            key=lambda x: -x.opportunity_score
        )
        strategic = sorted(
            [r for r in active_recs if r.display_category == "strategic"],
            key=lambda x: -x.opportunity_score
        )

        # Build sprint plan
        sprint_plan = {
            "sprint1_2": [{"recId": r.id, "title": r.title, "effortDays": r.total_effort_days or 0} for r in quick_wins[:5]],
            "sprint3_4": [{"recId": r.id, "title": r.title, "effortDays": r.total_effort_days or 0} for r in high_impact[:5]],
            "q2Plus": [{"recId": r.id, "title": r.title, "effortDays": r.total_effort_days or 0} for r in strategic[:5]],
            "totalEffortDays": sum(r.total_effort_days or 0 for r in active_recs),
            "capacityWarning": None
        }

        # Check capacity
        if session_obj.team_capacity:
            # Simple capacity check (could be more sophisticated)
            total_days = sprint_plan["totalEffortDays"]
            if total_days > 200:  # Rough threshold
                sprint_plan["capacityWarning"] = f"Plan requires {total_days} days of effort. Consider extending timeline or reducing scope."

        session_obj.sprint_plan = sprint_plan
        db.add(session_obj)
        db.commit()

    # --- Utility Methods ---

    def list_available_journey_maps(self, db: Session, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """List completed journey maps available for selection."""
        statement = select(JourneyMapSession).where(JourneyMapSession.status == "completed")
        if user_id:
            statement = statement.where(JourneyMapSession.user_id == user_id)
        statement = statement.order_by(desc(JourneyMapSession.created_at)).limit(50)

        journeys = list(db.exec(statement).all())

        result = []
        for j in journeys:
            # Count pain points
            pp_count = len(list(db.exec(
                select(JourneyPainPoint).where(JourneyPainPoint.journey_map_id == j.id)
            ).all()))

            result.append({
                "id": j.id,
                "journeyDescription": j.journey_description[:100] + "..." if len(j.journey_description) > 100 else j.journey_description,
                "mode": j.mode,
                "painPointCount": pp_count,
                "stageCount": len(j.stages or []),
                "createdAt": j.created_at.isoformat() if j.created_at else None
            })

        return result

    def list_available_gap_analyses(self, db: Session, user_id: Optional[int] = None) -> List[Dict[str, Any]]:
        """List completed gap analyses available for selection."""
        statement = select(GapAnalysisSession).where(GapAnalysisSession.status == "completed")
        if user_id:
            statement = statement.where(GapAnalysisSession.user_id == user_id)
        statement = statement.order_by(desc(GapAnalysisSession.created_at)).limit(50)

        analyses = list(db.exec(statement).all())

        result = []
        for a in analyses:
            # Count gaps
            gap_count = len(list(db.exec(
                select(GapItem).where(GapItem.session_id == a.id)
            ).all()))

            result.append({
                "id": a.id,
                "analysisName": a.analysis_name,
                "analysisType": a.analysis_type,
                "gapCount": gap_count,
                "createdAt": a.created_at.isoformat() if a.created_at else None
            })

        return result


# Global instance
cx_recommender_service = CXRecommenderService()
