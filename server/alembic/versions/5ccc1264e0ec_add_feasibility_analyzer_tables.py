"""Add feasibility analyzer tables

Revision ID: 5ccc1264e0ec
Revises: 0e9c4a51f89b
Create Date: 2025-12-24 07:09:01.247792

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '5ccc1264e0ec'
down_revision: Union[str, Sequence[str], None] = '0e9c4a51f89b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create feasibility analyzer tables."""
    # Create feasibility_sessions table
    op.create_table('feasibility_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('feature_description', sa.String(length=2000), nullable=False),
        sa.Column('technical_constraints', sa.String(), nullable=True),
        sa.Column('target_users', sa.String(), nullable=True),
        sa.Column('auto_detected_stack', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('progress_step', sa.Integer(), nullable=False),
        sa.Column('progress_message', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('go_no_go_recommendation', sa.String(), nullable=True),
        sa.Column('executive_summary', sa.String(), nullable=True),
        sa.Column('confidence_level', sa.String(), nullable=False),
        sa.Column('generation_metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create technical_components table
    op.create_table('technical_components',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('component_name', sa.String(), nullable=False),
        sa.Column('component_description', sa.String(), nullable=False),
        sa.Column('technical_category', sa.String(), nullable=False),
        sa.Column('optimistic_hours', sa.Float(), nullable=False),
        sa.Column('realistic_hours', sa.Float(), nullable=False),
        sa.Column('pessimistic_hours', sa.Float(), nullable=False),
        sa.Column('confidence_level', sa.String(), nullable=False),
        sa.Column('estimated_by_agent', sa.Boolean(), nullable=False),
        sa.Column('is_editable', sa.Boolean(), nullable=False),
        sa.Column('dependencies', sa.JSON(), nullable=True),
        sa.Column('can_parallelize', sa.Boolean(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['feasibility_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create timeline_scenarios table
    op.create_table('timeline_scenarios',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('scenario_type', sa.String(), nullable=False),
        sa.Column('total_weeks', sa.Float(), nullable=False),
        sa.Column('sprint_count', sa.Integer(), nullable=False),
        sa.Column('parallelization_factor', sa.Float(), nullable=False),
        sa.Column('overhead_percentage', sa.Float(), nullable=False),
        sa.Column('team_size_assumed', sa.Integer(), nullable=False),
        sa.Column('confidence_level', sa.String(), nullable=False),
        sa.Column('rationale', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['feasibility_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create risk_assessments table
    op.create_table('risk_assessments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('risk_category', sa.String(), nullable=False),
        sa.Column('risk_description', sa.String(), nullable=False),
        sa.Column('probability', sa.Float(), nullable=False),
        sa.Column('impact', sa.Float(), nullable=False),
        sa.Column('risk_score', sa.Float(), nullable=False),
        sa.Column('mitigation_strategy', sa.String(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['feasibility_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create skill_requirements table
    op.create_table('skill_requirements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('skill_name', sa.String(), nullable=False),
        sa.Column('proficiency_level', sa.String(), nullable=False),
        sa.Column('estimated_person_weeks', sa.Float(), nullable=False),
        sa.Column('is_gap', sa.Boolean(), nullable=False),
        sa.Column('gap_mitigation', sa.String(), nullable=True),
        sa.Column('display_order', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['feasibility_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create actual_results table
    op.create_table('actual_results',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('component_id', sa.Integer(), nullable=True),
        sa.Column('actual_hours_spent', sa.Float(), nullable=False),
        sa.Column('actual_completion_date', sa.DateTime(), nullable=False),
        sa.Column('variance_percentage', sa.Float(), nullable=False),
        sa.Column('lessons_learned', sa.String(), nullable=True),
        sa.Column('recorded_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['component_id'], ['technical_components.id'], ),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['session_id'], ['feasibility_sessions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop feasibility analyzer tables."""
    op.drop_table('actual_results')
    op.drop_table('skill_requirements')
    op.drop_table('risk_assessments')
    op.drop_table('timeline_scenarios')
    op.drop_table('technical_components')
    op.drop_table('feasibility_sessions')
