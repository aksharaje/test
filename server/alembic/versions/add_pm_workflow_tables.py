"""add_pm_workflow_tables

Revision ID: add_pm_workflow_tables
Revises: f6f5ed519d20
Create Date: 2025-12-30

Adds tables for PM workflow flows:
- Goal Setting Assistant
- OKR & KPI Generator
- Measurement Framework Builder
- Scope Definition Agent
- Scope Monitor
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes

# revision identifiers, used by Alembic.
revision: str = 'add_pm_workflow_tables'
down_revision: Union[str, Sequence[str], None] = 'f6f5ed519d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create all PM workflow tables."""

    # ==================== GOAL SETTING ====================
    op.create_table('goal_setting_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('context', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('timeframe', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('stakeholders', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('constraints', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('progress_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('goals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('timeframe', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('specific', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('measurable', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('achievable', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('relevant', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('time_bound', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('success_criteria', sa.JSON(), nullable=True),
        sa.Column('dependencies', sa.JSON(), nullable=True),
        sa.Column('risks', sa.JSON(), nullable=True),
        sa.Column('priority', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('estimated_effort', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['goal_setting_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # ==================== OKR GENERATOR ====================
    op.create_table('okr_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('goal_description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('goal_session_id', sa.Integer(), nullable=True),
        sa.Column('timeframe', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('team_context', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('measurement_preferences', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('progress_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['goal_session_id'], ['goal_setting_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('okr_objectives',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('timeframe', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('strategic_alignment', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('owner', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['okr_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('okr_key_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('objective_id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('metric_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('baseline_value', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('target_value', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('stretch_target', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('measurement_method', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('data_source', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('tracking_frequency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['objective_id'], ['okr_objectives.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['okr_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('okr_kpis',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('key_result_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('metric_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('formula', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('baseline', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('target', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('unit', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('data_source', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('collection_frequency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('owner', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['key_result_id'], ['okr_key_results.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['okr_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # ==================== MEASUREMENT FRAMEWORK ====================
    op.create_table('measurement_framework_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('objectives_description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('okr_session_id', sa.Integer(), nullable=True),
        sa.Column('existing_data_sources', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('reporting_requirements', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('stakeholder_audience', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('progress_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('framework_overview', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['okr_session_id'], ['okr_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('framework_metrics',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('metric_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('data_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('formula', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('unit', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('baseline', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('target', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('threshold_good', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('threshold_warning', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('threshold_critical', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('collection_method', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('collection_frequency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('data_owner', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('data_source', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('visualization_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('dashboard_placement', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['measurement_framework_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('framework_data_sources',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('source_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('connection_details', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('refresh_frequency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('reliability_score', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('data_quality_notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('linked_metric_ids', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['measurement_framework_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('framework_dashboards',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('audience', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('purpose', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('key_metrics', sa.JSON(), nullable=True),
        sa.Column('layout_description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('refresh_frequency', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('recommended_tool', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('implementation_notes', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['measurement_framework_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # ==================== SCOPE DEFINITION ====================
    op.create_table('scope_definition_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('project_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('product_vision', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('initial_requirements', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('known_constraints', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('stakeholder_needs', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('target_users', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('progress_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('scope_statement', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('scope_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('priority', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('rationale', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('estimated_complexity', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('dependencies', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_definition_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_assumptions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('assumption', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('risk_if_wrong', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('validation_method', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('confidence', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_definition_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_constraints',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('constraint', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('impact', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('flexibility', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('mitigation_strategy', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_definition_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_deliverables',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('acceptance_criteria', sa.JSON(), nullable=True),
        sa.Column('target_milestone', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('estimated_completion', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('dependencies', sa.JSON(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_definition_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # ==================== SCOPE MONITOR ====================
    op.create_table('scope_monitor_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('project_name', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('baseline_scope_id', sa.Integer(), nullable=True),
        sa.Column('baseline_description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('current_requirements', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('change_context', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('progress_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('scope_health_score', sa.Integer(), nullable=True),
        sa.Column('creep_risk_level', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('recommendations', sa.JSON(), nullable=True),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['baseline_scope_id'], ['scope_definition_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_changes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('change_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('impact_level', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('effort_impact', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('timeline_impact', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('budget_impact', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('is_scope_creep', sa.Boolean(), nullable=False),
        sa.Column('creep_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('justification', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('recommendation', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('recommendation_rationale', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_monitor_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_impact_assessments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('area', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('baseline_value', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('current_value', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('projected_value', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('impact_description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('impact_severity', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('mitigation_options', sa.JSON(), nullable=True),
        sa.Column('recommended_action', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_monitor_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_table('scope_alerts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('alert_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('severity', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('related_change_ids', sa.JSON(), nullable=True),
        sa.Column('action_required', sa.Boolean(), nullable=False),
        sa.Column('suggested_action', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column('escalation_needed', sa.Boolean(), nullable=False),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['scope_monitor_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop all PM workflow tables."""
    # Scope Monitor
    op.drop_table('scope_alerts')
    op.drop_table('scope_impact_assessments')
    op.drop_table('scope_changes')
    op.drop_table('scope_monitor_sessions')

    # Scope Definition
    op.drop_table('scope_deliverables')
    op.drop_table('scope_constraints')
    op.drop_table('scope_assumptions')
    op.drop_table('scope_items')
    op.drop_table('scope_definition_sessions')

    # Measurement Framework
    op.drop_table('framework_dashboards')
    op.drop_table('framework_data_sources')
    op.drop_table('framework_metrics')
    op.drop_table('measurement_framework_sessions')

    # OKR Generator
    op.drop_table('okr_kpis')
    op.drop_table('okr_key_results')
    op.drop_table('okr_objectives')
    op.drop_table('okr_sessions')

    # Goal Setting
    op.drop_table('goals')
    op.drop_table('goal_setting_sessions')
