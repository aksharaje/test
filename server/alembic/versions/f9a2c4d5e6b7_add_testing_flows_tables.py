"""Add Testing flows tables (Defect Manager, Release Readiness)

Revision ID: f9a2c4d5e6b7
Revises: e8f7a3b2c1d0
Create Date: 2025-01-01

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'f9a2c4d5e6b7'
down_revision: Union[str, None] = 'e8f7a3b2c1d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    # Defect Manager Sessions
    if 'defect_manager_sessions' not in existing_tables:
        op.create_table(
        'defect_manager_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False, server_default='Defect Analysis'),
        sa.Column('integration_id', sa.Integer(), nullable=False),
        sa.Column('detection_config', sa.JSON(), nullable=True),
        sa.Column('severity_config', sa.JSON(), nullable=True),
        sa.Column('category_config', sa.JSON(), nullable=True),
        sa.Column('project_filter', sa.String(), nullable=True),
        sa.Column('date_range_start', sa.DateTime(), nullable=True),
        sa.Column('date_range_end', sa.DateTime(), nullable=True),
        sa.Column('data_level', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('progress_step', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('progress_total', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('progress_message', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('analysis_snapshot', sa.JSON(), nullable=True),
        sa.Column('last_analysis_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_defect_manager_sessions_user_id', 'defect_manager_sessions', ['user_id'])
        op.create_index('ix_defect_manager_sessions_integration_id', 'defect_manager_sessions', ['integration_id'])

    # Analyzed Defects
    if 'analyzed_defects' not in existing_tables:
        op.create_table(
        'analyzed_defects',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(), nullable=False),
        sa.Column('external_url', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('status_category', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=False, server_default='medium'),
        sa.Column('severity_source', sa.String(), nullable=False, server_default='inferred'),
        sa.Column('severity_confidence', sa.Float(), nullable=False, server_default='0.5'),
        sa.Column('priority', sa.String(), nullable=True),
        sa.Column('priority_order', sa.Integer(), nullable=True),
        sa.Column('component', sa.String(), nullable=True),
        sa.Column('assignee', sa.String(), nullable=True),
        sa.Column('reporter', sa.String(), nullable=True),
        sa.Column('labels', sa.JSON(), nullable=True),
        sa.Column('affected_version', sa.String(), nullable=True),
        sa.Column('fix_version', sa.String(), nullable=True),
        sa.Column('environment', sa.String(), nullable=True),
        sa.Column('root_cause', sa.String(), nullable=True),
        sa.Column('root_cause_category', sa.String(), nullable=True),
        sa.Column('duplicate_of', sa.String(), nullable=True),
        sa.Column('duplicate_confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('pattern_group', sa.String(), nullable=True),
        sa.Column('suggested_priority', sa.Integer(), nullable=True),
        sa.Column('priority_reasoning', sa.Text(), nullable=True),
        sa.Column('created_external', sa.DateTime(), nullable=True),
        sa.Column('updated_external', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('days_open', sa.Integer(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_analyzed_defects_session_id', 'analyzed_defects', ['session_id'])
        op.create_index('ix_analyzed_defects_external_id', 'analyzed_defects', ['external_id'])

    # Release Readiness Sessions
    if 'release_readiness_sessions' not in existing_tables:
        op.create_table(
        'release_readiness_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('name', sa.String(), nullable=False, server_default='Release Assessment'),
        sa.Column('integration_id', sa.Integer(), nullable=False),
        sa.Column('release_identifier', sa.String(), nullable=False),
        sa.Column('release_type', sa.String(), nullable=False, server_default='fixVersion'),
        sa.Column('project_key', sa.String(), nullable=True),
        sa.Column('data_sources', sa.JSON(), nullable=True),
        sa.Column('scoring_weights', sa.JSON(), nullable=True),
        sa.Column('ac_config', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('progress_step', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('progress_total', sa.Integer(), nullable=False, server_default='6'),
        sa.Column('progress_message', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('readiness_score', sa.Integer(), nullable=True),
        sa.Column('max_possible_score', sa.Integer(), nullable=False, server_default='100'),
        sa.Column('confidence_level', sa.String(), nullable=False, server_default='unknown'),
        sa.Column('recommendation', sa.String(), nullable=False, server_default='pending'),
        sa.Column('recommendation_details', sa.JSON(), nullable=True),
        sa.Column('component_scores', sa.JSON(), nullable=True),
        sa.Column('target_release_date', sa.DateTime(), nullable=True),
        sa.Column('last_assessment_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_release_readiness_sessions_user_id', 'release_readiness_sessions', ['user_id'])
        op.create_index('ix_release_readiness_sessions_integration_id', 'release_readiness_sessions', ['integration_id'])

    # Release Work Items
    if 'release_work_items' not in existing_tables:
        op.create_table(
        'release_work_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(), nullable=False),
        sa.Column('external_url', sa.String(), nullable=True),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('status_category', sa.String(), nullable=False),
        sa.Column('severity', sa.String(), nullable=True),
        sa.Column('is_blocking', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('has_ac', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('ac_source', sa.String(), nullable=True),
        sa.Column('ac_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ac_verified', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('linked_tests', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tests_passed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tests_failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('test_coverage_percent', sa.Float(), nullable=True),
        sa.Column('assignee', sa.String(), nullable=True),
        sa.Column('story_points', sa.Float(), nullable=True),
        sa.Column('component', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        )
        op.create_index('ix_release_work_items_session_id', 'release_work_items', ['session_id'])
        op.create_index('ix_release_work_items_external_id', 'release_work_items', ['external_id'])


def downgrade() -> None:
    op.drop_index('ix_release_work_items_external_id', 'release_work_items')
    op.drop_index('ix_release_work_items_session_id', 'release_work_items')
    op.drop_table('release_work_items')

    op.drop_index('ix_release_readiness_sessions_integration_id', 'release_readiness_sessions')
    op.drop_index('ix_release_readiness_sessions_user_id', 'release_readiness_sessions')
    op.drop_table('release_readiness_sessions')

    op.drop_index('ix_analyzed_defects_external_id', 'analyzed_defects')
    op.drop_index('ix_analyzed_defects_session_id', 'analyzed_defects')
    op.drop_table('analyzed_defects')

    op.drop_index('ix_defect_manager_sessions_integration_id', 'defect_manager_sessions')
    op.drop_index('ix_defect_manager_sessions_user_id', 'defect_manager_sessions')
    op.drop_table('defect_manager_sessions')
