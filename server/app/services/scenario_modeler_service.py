"""
Scenario Modeler Service

Service layer for the Scenario Modeler that enables "what-if" analysis
by generating and comparing roadmap scenario variations.

Pipeline stages (4 specialized agents):
1. What-If Generator - Generate alternative roadmap scenarios
2. Impact Simulator - Calculate quantitative impacts vs baseline
3. Risk Comparator - Assess risk profiles across scenarios
4. Trade-Off Visualizer - Create comparative analysis
"""
import json
import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlmodel import Session, select

from app.models.scenario_modeler import (
    ScenarioSession,
    ScenarioVariant,
    ScenarioSessionCreate,
    ScenarioVariantCreate,
    ScenarioVariantUpdate,
    ScenarioComparisonReport,
    ScenarioSessionResponse,
    SCENARIO_TEMPLATES,
)
from app.models.roadmap_planner import (
    RoadmapSession,
    RoadmapItem,
    RoadmapTheme,
    RoadmapMilestone,
    RoadmapDependency,
)
from app.services.llm_json_utils import get_strict_json_llm, StrictJSONLLM


class ScenarioModelerService:
    """Service for Scenario Modeler operations"""

    def __init__(self, db: Session):
        self.db = db
        self._llm: Optional[StrictJSONLLM] = None

    @property
    def llm(self) -> StrictJSONLLM:
        """Lazy load the strict JSON LLM"""
        if self._llm is None:
            self._llm = get_strict_json_llm()
        return self._llm

    # =========================================================================
    # Session Management
    # =========================================================================

    def create_session(self, data: ScenarioSessionCreate, user_id: Optional[int] = None) -> ScenarioSession:
        """Create a new scenario modeling session from an existing roadmap"""
        # Verify roadmap exists
        roadmap = self.db.get(RoadmapSession, data.roadmap_session_id)
        if not roadmap:
            raise ValueError(f"Roadmap session {data.roadmap_session_id} not found")

        # Create baseline snapshot of the roadmap
        baseline_snapshot = self._create_roadmap_snapshot(data.roadmap_session_id)

        session = ScenarioSession(
            user_id=user_id,
            roadmap_session_id=data.roadmap_session_id,
            name=data.name or f"Scenarios for {roadmap.name}",
            description=data.description,
            baseline_snapshot=baseline_snapshot,
            status="draft",
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        # Create baseline variant (the original roadmap as-is)
        baseline_variant = ScenarioVariant(
            session_id=session.id,
            name="Baseline",
            description="Original roadmap without modifications",
            is_baseline=True,
            variable_changes=[],
            generated_roadmap=baseline_snapshot,
            status="completed",
        )
        self.db.add(baseline_variant)
        session.total_variants = 1
        self.db.add(session)
        self.db.commit()
        self.db.refresh(baseline_variant)

        return session

    def get_session(self, session_id: int, user_id: Optional[int] = None) -> Optional[ScenarioSession]:
        """Get a session by ID"""
        session = self.db.get(ScenarioSession, session_id)
        if session and user_id and session.user_id and session.user_id != user_id:
            return None
        return session

    def get_sessions(self, user_id: Optional[int] = None) -> List[ScenarioSession]:
        """Get all sessions, optionally filtered by user"""
        query = select(ScenarioSession).order_by(ScenarioSession.created_at.desc())
        if user_id:
            query = query.where(ScenarioSession.user_id == user_id)
        return list(self.db.exec(query).all())

    def get_sessions_for_roadmap(self, roadmap_session_id: int) -> List[ScenarioSession]:
        """Get all scenario sessions for a specific roadmap"""
        query = select(ScenarioSession).where(
            ScenarioSession.roadmap_session_id == roadmap_session_id
        ).order_by(ScenarioSession.created_at.desc())
        return list(self.db.exec(query).all())

    def delete_session(self, session_id: int, user_id: Optional[int] = None) -> bool:
        """Delete a session and all its variants"""
        session = self.get_session(session_id, user_id=user_id)
        if not session:
            return False

        # Delete all variants first and commit to satisfy FK constraint
        variants = self.db.exec(
            select(ScenarioVariant).where(ScenarioVariant.session_id == session_id)
        ).all()
        for variant in variants:
            self.db.delete(variant)
        self.db.commit()

        # Now delete the session
        self.db.delete(session)
        self.db.commit()
        return True

    def get_full_session(self, session_id: int, user_id: Optional[int] = None) -> Optional[ScenarioSessionResponse]:
        """Get session with all variants and comparison"""
        session = self.get_session(session_id, user_id=user_id)
        if not session:
            return None

        variants = self.get_variants(session_id)
        comparison = None

        # Generate comparison if we have completed variants
        completed_variants = [v for v in variants if v.status == "completed"]
        if len(completed_variants) >= 2:
            comparison = self._generate_comparison_report(session, completed_variants)

        return ScenarioSessionResponse(
            session=session,
            variants=variants,
            comparison=comparison,
        )

    # =========================================================================
    # Variant Management
    # =========================================================================

    def get_variants(self, session_id: int) -> List[ScenarioVariant]:
        """Get all variants for a session"""
        query = select(ScenarioVariant).where(
            ScenarioVariant.session_id == session_id
        ).order_by(ScenarioVariant.created_at)
        return list(self.db.exec(query).all())

    def get_variant(self, variant_id: int) -> Optional[ScenarioVariant]:
        """Get a variant by ID"""
        return self.db.get(ScenarioVariant, variant_id)

    def create_variant(self, session_id: int, data: ScenarioVariantCreate) -> ScenarioVariant:
        """Create a new scenario variant"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        # Convert variable changes to dict format
        changes = [
            {
                "change_type": c.change_type,
                "target": c.target,
                "target_id": c.target_id,
                "value": c.value,
                "description": c.description,
            }
            for c in data.variable_changes
        ]

        variant = ScenarioVariant(
            session_id=session_id,
            name=data.name,
            description=data.description,
            variable_changes=changes,
            status="pending",
        )
        self.db.add(variant)

        session.total_variants += 1
        self.db.add(session)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def create_variant_from_template(self, session_id: int, template_name: str) -> ScenarioVariant:
        """Create a variant from a predefined template"""
        template = SCENARIO_TEMPLATES.get(template_name)
        if not template:
            raise ValueError(f"Unknown template: {template_name}")

        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        variant = ScenarioVariant(
            session_id=session_id,
            name=template["name"],
            description=template["description"],
            variable_changes=template["variable_changes"],
            status="pending",
        )
        self.db.add(variant)

        session.total_variants += 1
        self.db.add(session)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def update_variant(self, variant_id: int, data: ScenarioVariantUpdate) -> Optional[ScenarioVariant]:
        """Update a variant"""
        variant = self.get_variant(variant_id)
        if not variant:
            return None

        if variant.is_baseline:
            raise ValueError("Cannot modify baseline variant")

        if data.name is not None:
            variant.name = data.name
        if data.description is not None:
            variant.description = data.description
        if data.variable_changes is not None:
            variant.variable_changes = [
                {
                    "change_type": c.change_type,
                    "target": c.target,
                    "target_id": c.target_id,
                    "value": c.value,
                    "description": c.description,
                }
                for c in data.variable_changes
            ]
            # Reset status if changes were modified
            variant.status = "pending"

        variant.updated_at = datetime.utcnow()
        self.db.add(variant)
        self.db.commit()
        self.db.refresh(variant)
        return variant

    def delete_variant(self, variant_id: int) -> bool:
        """Delete a variant"""
        variant = self.get_variant(variant_id)
        if not variant:
            return False

        if variant.is_baseline:
            raise ValueError("Cannot delete baseline variant")

        session = self.get_session(variant.session_id)
        if session:
            session.total_variants = max(0, session.total_variants - 1)
            self.db.add(session)

        self.db.delete(variant)
        self.db.commit()
        return True

    # =========================================================================
    # Pipeline Execution
    # =========================================================================

    async def run_pipeline(self, session_id: int) -> ScenarioSession:
        """Run the scenario modeling pipeline for all pending variants"""
        session = self.get_session(session_id)
        if not session:
            raise ValueError(f"Session {session_id} not found")

        try:
            session.status = "generating"
            session.progress_step = 0
            session.progress_message = "Starting scenario generation..."
            self.db.add(session)
            self.db.commit()

            # Get all pending variants
            variants = [v for v in self.get_variants(session_id) if v.status == "pending"]

            if not variants:
                session.status = "completed"
                session.progress_message = "No pending variants to process"
                session.completed_at = datetime.utcnow()
                self.db.add(session)
                self.db.commit()
                return session

            # Process each variant
            total_variants = len(variants)
            for i, variant in enumerate(variants):
                session.progress_message = f"Generating scenario {i + 1} of {total_variants}: {variant.name}"
                session.progress_step = 1
                self.db.add(session)
                self.db.commit()

                await self._generate_variant(variant, session.baseline_snapshot)

            # Generate comparison
            session.status = "comparing"
            session.progress_step = 3
            session.progress_message = "Comparing scenarios..."
            self.db.add(session)
            self.db.commit()

            # Update viable count
            all_variants = self.get_variants(session_id)
            session.viable_variants = sum(1 for v in all_variants if v.is_viable)

            session.status = "completed"
            session.progress_step = 4
            session.progress_message = "Scenario analysis complete!"
            session.completed_at = datetime.utcnow()
            self.db.add(session)
            self.db.commit()

            return session

        except Exception as e:
            session = self.get_session(session_id)
            if session:
                session.status = "failed"
                session.error_message = str(e)
                self.db.add(session)
                self.db.commit()
            raise

    async def _generate_variant(self, variant: ScenarioVariant, baseline: Dict[str, Any]):
        """Generate a single scenario variant"""
        try:
            variant.status = "generating"
            self.db.add(variant)
            self.db.commit()

            # Apply variable changes to baseline
            modified_roadmap = await self._apply_variable_changes(baseline, variant.variable_changes)

            # Run impact analysis
            impact = await self._analyze_impact(baseline, modified_roadmap, variant.variable_changes)

            # Run risk assessment
            risk_score, risk_factors = await self._assess_risk(modified_roadmap, variant.variable_changes)

            # Generate trade-offs
            trade_offs = await self._generate_trade_offs(baseline, modified_roadmap, impact)

            # Check viability
            is_viable, non_viable_reason = self._check_viability(modified_roadmap, impact)

            # Update variant
            variant.generated_roadmap = modified_roadmap
            variant.impact_summary = impact
            variant.risk_score = risk_score
            variant.risk_factors = risk_factors
            variant.trade_offs = trade_offs
            variant.is_viable = is_viable
            variant.non_viable_reason = non_viable_reason
            variant.status = "completed"
            variant.updated_at = datetime.utcnow()
            self.db.add(variant)
            self.db.commit()

        except Exception as e:
            variant.status = "failed"
            variant.non_viable_reason = str(e)
            self.db.add(variant)
            self.db.commit()
            raise

    async def _apply_variable_changes(
        self,
        baseline: Dict[str, Any],
        changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Apply variable changes to baseline and reoptimize"""
        # Create a deep copy of baseline
        modified = json.loads(json.dumps(baseline))

        # Group changes by type
        capacity_changes = [c for c in changes if c.get("change_type") == "capacity"]
        priority_changes = [c for c in changes if c.get("change_type") == "priority"]
        timeline_changes = [c for c in changes if c.get("change_type") == "timeline"]
        scope_changes = [c for c in changes if c.get("change_type") == "scope"]

        # Apply capacity changes
        for change in capacity_changes:
            value = change.get("value", "")
            if isinstance(value, str) and value.endswith("%"):
                delta = int(value.replace("%", "").replace("+", "")) / 100
                original_velocity = modified.get("session", {}).get("team_velocity", 40)
                modified["session"]["team_velocity"] = int(original_velocity * (1 + delta))

        # Apply priority changes (re-prioritize items)
        for change in priority_changes:
            target_id = change.get("target_id")
            new_priority = change.get("value")
            if target_id and new_priority:
                for item in modified.get("items", []):
                    if item.get("id") == target_id:
                        item["priority"] = new_priority
                        break

        # Apply scope changes (defer items)
        for change in scope_changes:
            if change.get("target") == "low_priority_items" and change.get("value") == "defer":
                # Mark low-priority items as excluded
                for item in modified.get("items", []):
                    if item.get("priority", 3) >= 4:  # Priority 4-5 is low
                        item["is_excluded"] = True
                        item["assigned_sprint"] = None

        # Apply timeline changes
        for change in timeline_changes:
            value = change.get("value", "")
            if isinstance(value, str) and value.endswith("%"):
                delta = int(value.replace("%", "").replace("-", "")) / 100
                # Compress timeline by reducing total sprints
                current_sprints = modified.get("session", {}).get("total_sprints", 10)
                new_sprints = max(1, int(current_sprints * (1 - delta)))
                modified["session"]["total_sprints"] = new_sprints

        # Re-optimize sprint assignments based on changes
        modified = await self._reoptimize_assignments(modified)

        return modified

    async def _reoptimize_assignments(self, roadmap: Dict[str, Any]) -> Dict[str, Any]:
        """Re-optimize sprint assignments after variable changes"""
        items = roadmap.get("items", [])
        session_data = roadmap.get("session", {})

        if not items:
            return roadmap

        # Filter out excluded items
        active_items = [i for i in items if not i.get("is_excluded", False)]

        # Sort by priority
        active_items.sort(key=lambda x: (x.get("priority", 3), x.get("sequence_order", 0)))

        # Recalculate sprint assignments
        velocity = session_data.get("team_velocity", 40)
        buffer = session_data.get("buffer_percentage", 20)
        effective_velocity = int(velocity * (1 - buffer / 100))

        current_sprint = 1
        current_sprint_points = 0

        for item in active_items:
            effort = item.get("effort_points", 5)

            if current_sprint_points + effort > effective_velocity:
                current_sprint += 1
                current_sprint_points = 0

            item["assigned_sprint"] = current_sprint
            current_sprint_points += effort

        # Update session totals
        roadmap["session"]["total_sprints"] = current_sprint

        return roadmap

    async def _analyze_impact(
        self,
        baseline: Dict[str, Any],
        modified: Dict[str, Any],
        changes: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Analyze impact of changes vs baseline"""
        baseline_items = {i["id"]: i for i in baseline.get("items", [])}
        modified_items = {i["id"]: i for i in modified.get("items", [])}

        items_accelerated = []
        items_deferred = []
        items_excluded = []

        for item_id, modified_item in modified_items.items():
            baseline_item = baseline_items.get(item_id)
            if not baseline_item:
                continue

            baseline_sprint = baseline_item.get("assigned_sprint")
            modified_sprint = modified_item.get("assigned_sprint")

            if modified_item.get("is_excluded") and not baseline_item.get("is_excluded"):
                items_excluded.append({
                    "id": item_id,
                    "title": modified_item.get("title"),
                    "reason": "Deferred due to scope change"
                })
            elif baseline_sprint and modified_sprint:
                delta = baseline_sprint - modified_sprint
                if delta > 0:
                    items_accelerated.append({
                        "id": item_id,
                        "title": modified_item.get("title"),
                        "sprints_earlier": delta
                    })
                elif delta < 0:
                    items_deferred.append({
                        "id": item_id,
                        "title": modified_item.get("title"),
                        "sprints_later": -delta
                    })

        baseline_sprints = baseline.get("session", {}).get("total_sprints", 0)
        modified_sprints = modified.get("session", {}).get("total_sprints", 0)

        return {
            "items_accelerated": items_accelerated,
            "items_accelerated_count": len(items_accelerated),
            "items_deferred": items_deferred,
            "items_deferred_count": len(items_deferred),
            "items_excluded": items_excluded,
            "items_excluded_count": len(items_excluded),
            "timeline_delta": modified_sprints - baseline_sprints,
            "baseline_sprints": baseline_sprints,
            "modified_sprints": modified_sprints,
            "capacity_change": self._calculate_capacity_change(baseline, modified),
            "variable_changes_applied": len(changes),
        }

    def _calculate_capacity_change(self, baseline: Dict, modified: Dict) -> Dict[str, Any]:
        """Calculate capacity utilization changes"""
        baseline_velocity = baseline.get("session", {}).get("team_velocity", 40)
        modified_velocity = modified.get("session", {}).get("team_velocity", 40)

        return {
            "baseline_velocity": baseline_velocity,
            "modified_velocity": modified_velocity,
            "velocity_delta": modified_velocity - baseline_velocity,
            "velocity_delta_percentage": round((modified_velocity - baseline_velocity) / baseline_velocity * 100, 1) if baseline_velocity > 0 else 0
        }

    async def _assess_risk(
        self,
        roadmap: Dict[str, Any],
        changes: List[Dict[str, Any]]
    ) -> tuple[int, List[Dict[str, Any]]]:
        """Assess risk profile of the scenario"""
        risk_factors = []
        total_risk = 0

        # Check for capacity risk (over-commitment)
        session = roadmap.get("session", {})
        items = roadmap.get("items", [])
        velocity = session.get("team_velocity", 40)
        buffer = session.get("buffer_percentage", 20)
        effective_velocity = int(velocity * (1 - buffer / 100))

        # Group items by sprint
        sprint_loads = {}
        for item in items:
            sprint = item.get("assigned_sprint")
            if sprint and not item.get("is_excluded"):
                sprint_loads[sprint] = sprint_loads.get(sprint, 0) + item.get("effort_points", 0)

        over_capacity_sprints = []
        for sprint, load in sprint_loads.items():
            if load > effective_velocity:
                over_capacity_sprints.append(sprint)
                total_risk += 15

        if over_capacity_sprints:
            risk_factors.append({
                "type": "capacity",
                "severity": "high" if len(over_capacity_sprints) > 2 else "medium",
                "description": f"{len(over_capacity_sprints)} sprint(s) are over capacity",
                "affected_sprints": over_capacity_sprints
            })

        # Check for aggressive capacity changes
        for change in changes:
            if change.get("change_type") == "capacity":
                value = change.get("value", "")
                if isinstance(value, str) and "-" in value:
                    delta = abs(int(value.replace("%", "").replace("-", "")))
                    if delta >= 30:
                        total_risk += 25
                        risk_factors.append({
                            "type": "capacity",
                            "severity": "high",
                            "description": f"Aggressive capacity reduction of {delta}%"
                        })

        # Check for timeline compression
        for change in changes:
            if change.get("change_type") == "timeline":
                value = change.get("value", "")
                if isinstance(value, str) and "-" in value:
                    total_risk += 20
                    risk_factors.append({
                        "type": "timeline",
                        "severity": "medium",
                        "description": "Timeline compression increases delivery risk"
                    })

        # Normalize risk score to 0-100
        risk_score = min(100, total_risk)

        return risk_score, risk_factors

    async def _generate_trade_offs(
        self,
        baseline: Dict[str, Any],
        modified: Dict[str, Any],
        impact: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Generate trade-off analysis"""
        trade_offs = []

        # Timeline trade-off
        timeline_delta = impact.get("timeline_delta", 0)
        if timeline_delta < 0:
            trade_offs.append({
                "gain": f"Roadmap completes {abs(timeline_delta)} sprint(s) earlier",
                "cost": "Higher risk of burnout and quality issues",
                "description": "Faster delivery requires sustained high velocity"
            })
        elif timeline_delta > 0:
            trade_offs.append({
                "gain": "More buffer for unexpected work",
                "cost": f"Roadmap extends by {timeline_delta} sprint(s)",
                "description": "Extended timeline provides flexibility"
            })

        # Capacity trade-off
        capacity_change = impact.get("capacity_change", {})
        velocity_delta = capacity_change.get("velocity_delta", 0)
        if velocity_delta > 0:
            trade_offs.append({
                "gain": f"{impact.get('items_accelerated_count', 0)} items delivered earlier",
                "cost": "Additional resource cost",
                "description": "Increased capacity accelerates delivery"
            })
        elif velocity_delta < 0:
            trade_offs.append({
                "gain": "Reduced resource costs",
                "cost": f"{impact.get('items_deferred_count', 0)} items delayed",
                "description": "Reduced capacity extends timeline"
            })

        # Scope trade-off
        excluded_count = impact.get("items_excluded_count", 0)
        if excluded_count > 0:
            trade_offs.append({
                "gain": "Focused delivery on high-priority items",
                "cost": f"{excluded_count} item(s) deferred to future",
                "description": "Scope reduction enables faster MVP delivery"
            })

        return trade_offs

    def _check_viability(
        self,
        roadmap: Dict[str, Any],
        impact: Dict[str, Any]
    ) -> tuple[bool, Optional[str]]:
        """Check if the scenario is viable"""
        session = roadmap.get("session", {})
        items = roadmap.get("items", [])

        # Check if any items can be scheduled
        scheduled_items = [i for i in items if i.get("assigned_sprint") and not i.get("is_excluded")]
        if not scheduled_items:
            return False, "No items can be scheduled within constraints"

        # Check for severe over-capacity
        velocity = session.get("team_velocity", 40)
        buffer = session.get("buffer_percentage", 20)
        effective_velocity = int(velocity * (1 - buffer / 100))

        if effective_velocity <= 0:
            return False, "Effective capacity is zero or negative"

        # Check for extreme timeline compression
        total_effort = sum(i.get("effort_points", 0) for i in scheduled_items)
        min_sprints_needed = math.ceil(total_effort / effective_velocity)
        current_sprints = session.get("total_sprints", 0)

        if current_sprints < min_sprints_needed * 0.5:
            return False, f"Timeline too compressed: need at least {min_sprints_needed} sprints"

        return True, None

    # =========================================================================
    # Comparison Report
    # =========================================================================

    def _generate_comparison_report(
        self,
        session: ScenarioSession,
        variants: List[ScenarioVariant]
    ) -> ScenarioComparisonReport:
        """Generate comparison report across variants"""
        baseline = next((v for v in variants if v.is_baseline), None)
        if not baseline:
            return None

        timeline_comparison = {}
        capacity_comparison = {}
        risk_comparison = {}
        theme_comparison = {}
        trade_off_matrix = []

        for variant in variants:
            roadmap = variant.generated_roadmap
            session_data = roadmap.get("session", {})

            # Timeline comparison (use string keys for Pydantic Dict[str, Any])
            total_sprints = session_data.get("total_sprints", 0)
            baseline_sprints = baseline.generated_roadmap.get("session", {}).get("total_sprints", 0)
            timeline_comparison[str(variant.id)] = {
                "total_sprints": total_sprints,
                "delta_from_baseline": total_sprints - baseline_sprints
            }

            # Capacity comparison
            velocity = session_data.get("team_velocity", 40)
            capacity_comparison[str(variant.id)] = {
                "team_velocity": velocity,
                "delta_from_baseline": velocity - baseline.generated_roadmap.get("session", {}).get("team_velocity", 40)
            }

            # Risk comparison
            risk_comparison[str(variant.id)] = {
                "risk_score": variant.risk_score,
                "top_risks": variant.risk_factors[:3] if variant.risk_factors else []
            }

            # Trade-off matrix entry
            trade_off_matrix.append({
                "variant_id": variant.id,
                "variant_name": variant.name,
                "gains": [t.get("gain") for t in variant.trade_offs],
                "costs": [t.get("cost") for t in variant.trade_offs],
                "is_viable": variant.is_viable,
                "risk_score": variant.risk_score
            })

        # Generate recommendations
        recommendations = self._generate_recommendations(variants)

        return ScenarioComparisonReport(
            session_id=session.id,
            baseline_variant_id=baseline.id,
            variants=variants,
            timeline_comparison=timeline_comparison,
            capacity_comparison=capacity_comparison,
            risk_comparison=risk_comparison,
            theme_comparison=theme_comparison,
            trade_off_matrix=trade_off_matrix,
            recommendations=recommendations,
        )

    def _generate_recommendations(self, variants: List[ScenarioVariant]) -> List[str]:
        """Generate recommendations based on variant analysis"""
        recommendations = []

        viable_variants = [v for v in variants if v.is_viable and not v.is_baseline]

        if not viable_variants:
            recommendations.append("All non-baseline scenarios are not viable. Consider less aggressive changes.")
            return recommendations

        # Find lowest risk viable scenario
        lowest_risk = min(viable_variants, key=lambda v: v.risk_score)
        if lowest_risk.risk_score < 50:
            recommendations.append(
                f"'{lowest_risk.name}' has the lowest risk score ({lowest_risk.risk_score}) "
                "and may be the safest option."
            )

        # Find scenario with most acceleration
        best_acceleration = max(
            viable_variants,
            key=lambda v: v.impact_summary.get("items_accelerated_count", 0)
        )
        accel_count = best_acceleration.impact_summary.get("items_accelerated_count", 0)
        if accel_count > 0:
            recommendations.append(
                f"'{best_acceleration.name}' accelerates {accel_count} items and may "
                "be best for faster delivery."
            )

        return recommendations

    # =========================================================================
    # Promote Variant
    # =========================================================================

    async def promote_variant(self, variant_id: int) -> bool:
        """Promote a variant to become the new baseline roadmap"""
        variant = self.get_variant(variant_id)
        if not variant:
            return False

        if not variant.is_viable:
            raise ValueError("Cannot promote non-viable variant")

        # This would typically update the source roadmap
        # For now, we just mark it as promoted
        # In a real implementation, this would update the RoadmapSession

        return True

    # =========================================================================
    # Utility Methods
    # =========================================================================

    def _create_roadmap_snapshot(self, roadmap_session_id: int) -> Dict[str, Any]:
        """Create a snapshot of the current roadmap state"""
        roadmap = self.db.get(RoadmapSession, roadmap_session_id)
        if not roadmap:
            return {}

        # Get items
        items = self.db.exec(
            select(RoadmapItem).where(RoadmapItem.session_id == roadmap_session_id)
        ).all()

        # Get themes
        themes = self.db.exec(
            select(RoadmapTheme).where(RoadmapTheme.session_id == roadmap_session_id)
        ).all()

        # Get milestones
        milestones = self.db.exec(
            select(RoadmapMilestone).where(RoadmapMilestone.session_id == roadmap_session_id)
        ).all()

        # Get dependencies
        dependencies = self.db.exec(
            select(RoadmapDependency).where(RoadmapDependency.session_id == roadmap_session_id)
        ).all()

        return {
            "session": {
                "id": roadmap.id,
                "name": roadmap.name,
                "sprint_length_weeks": roadmap.sprint_length_weeks,
                "team_velocity": roadmap.team_velocity,
                "team_count": roadmap.team_count,
                "buffer_percentage": roadmap.buffer_percentage,
                "total_sprints": roadmap.total_sprints,
                "total_items": roadmap.total_items,
            },
            "items": [
                {
                    "id": item.id,
                    "title": item.title,
                    "description": item.description,
                    "priority": item.priority,
                    "effort_points": item.effort_points,
                    "risk_level": item.risk_level,
                    "sequence_order": item.sequence_order,
                    "assigned_sprint": item.assigned_sprint,
                    "theme_id": item.theme_id,
                    "is_excluded": item.is_excluded,
                }
                for item in items
            ],
            "themes": [
                {
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "color": theme.color,
                    "total_effort_points": theme.total_effort_points,
                }
                for theme in themes
            ],
            "milestones": [
                {
                    "id": ms.id,
                    "name": ms.name,
                    "target_sprint": ms.target_sprint,
                    "theme_id": ms.theme_id,
                }
                for ms in milestones
            ],
            "dependencies": [
                {
                    "id": dep.id,
                    "from_item_id": dep.from_item_id,
                    "to_item_id": dep.to_item_id,
                    "dependency_type": dep.dependency_type,
                }
                for dep in dependencies
            ],
        }

    def get_scenario_templates(self) -> List[Dict[str, Any]]:
        """Get available scenario templates"""
        from humps import camelize

        templates = []
        for key, value in SCENARIO_TEMPLATES.items():
            template = {"id": key, **value}
            # Convert to camelCase for frontend
            templates.append(camelize(template))
        return templates
