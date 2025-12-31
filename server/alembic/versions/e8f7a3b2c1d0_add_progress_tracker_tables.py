"""add progress tracker tables

Revision ID: e8f7a3b2c1d0
Revises: dc96861af357
Create Date: 2024-12-31 22:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'e8f7a3b2c1d0'
down_revision: Union[str, None] = 'dc96861af357'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create progress_tracker_sessions table
    op.create_table(
        'progress_tracker_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('integration_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('template_id', sa.String(), nullable=False, server_default='basic'),
        sa.Column('sprint_filter', sa.JSON(), nullable=True),
        sa.Column('blocker_config', sa.JSON(), nullable=True),
        sa.Column('sync_config', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='draft'),
        sa.Column('progress_step', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('progress_total', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('progress_message', sa.String(), nullable=True),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('metrics_snapshot', sa.JSON(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('items_synced', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('blockers_detected', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['integration_id'], ['integrations.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_progress_tracker_sessions_integration_id', 'progress_tracker_sessions', ['integration_id'])
    op.create_index('ix_progress_tracker_sessions_user_id', 'progress_tracker_sessions', ['user_id'])

    # Create tracked_work_items table
    op.create_table(
        'tracked_work_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('session_id', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(), nullable=False),
        sa.Column('external_url', sa.String(), nullable=True),
        sa.Column('item_type', sa.String(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('status_category', sa.String(), nullable=False),
        sa.Column('assignee', sa.String(), nullable=True),
        sa.Column('assignee_email', sa.String(), nullable=True),
        sa.Column('sprint_name', sa.String(), nullable=True),
        sa.Column('sprint_id', sa.String(), nullable=True),
        sa.Column('story_points', sa.Float(), nullable=True),
        sa.Column('original_estimate', sa.Float(), nullable=True),
        sa.Column('time_spent', sa.Float(), nullable=True),
        sa.Column('priority', sa.String(), nullable=True),
        sa.Column('priority_order', sa.Integer(), nullable=True),
        sa.Column('labels', sa.JSON(), nullable=True),
        sa.Column('components', sa.JSON(), nullable=True),
        sa.Column('parent_id', sa.String(), nullable=True),
        sa.Column('parent_title', sa.String(), nullable=True),
        sa.Column('blocker_signals', sa.JSON(), nullable=True),
        sa.Column('blocker_confidence', sa.Float(), nullable=False, server_default='0'),
        sa.Column('is_blocked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('blocker_reason', sa.String(), nullable=True),
        sa.Column('links', sa.JSON(), nullable=True),
        sa.Column('last_updated_external', sa.DateTime(), nullable=True),
        sa.Column('days_in_status', sa.Integer(), nullable=True),
        sa.Column('raw_data', sa.JSON(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['session_id'], ['progress_tracker_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_tracked_work_items_session_id', 'tracked_work_items', ['session_id'])
    op.create_index('ix_tracked_work_items_external_id', 'tracked_work_items', ['external_id'])
    op.create_index('ix_tracked_work_items_is_blocked', 'tracked_work_items', ['is_blocked'])


def downgrade() -> None:
    op.drop_index('ix_tracked_work_items_is_blocked', table_name='tracked_work_items')
    op.drop_index('ix_tracked_work_items_external_id', table_name='tracked_work_items')
    op.drop_index('ix_tracked_work_items_session_id', table_name='tracked_work_items')
    op.drop_table('tracked_work_items')

    op.drop_index('ix_progress_tracker_sessions_user_id', table_name='progress_tracker_sessions')
    op.drop_index('ix_progress_tracker_sessions_integration_id', table_name='progress_tracker_sessions')
    op.drop_table('progress_tracker_sessions')
