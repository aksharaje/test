"""add_roadmap_item_segments_table

Revision ID: 7299ef8b2376
Revises: add_sprint_span_roadmap
Create Date: 2025-12-29 14:27:37.278231

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7299ef8b2376'
down_revision: Union[str, Sequence[str], None] = 'add_sprint_span_roadmap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'roadmap_item_segments' not in existing_tables:
        op.create_table(
        'roadmap_item_segments',
        sa.Column('id', sa.Integer(), primary_key=True, nullable=False),
        sa.Column('item_id', sa.Integer(), sa.ForeignKey('roadmap_items.id', ondelete='CASCADE'), nullable=False),
        sa.Column('assigned_team', sa.Integer(), nullable=False, default=1),
        sa.Column('start_sprint', sa.Integer(), nullable=False, default=1),
        sa.Column('sprint_count', sa.Integer(), nullable=False, default=1),
        sa.Column('effort_points', sa.Integer(), nullable=False, default=0),
        sa.Column('sequence_order', sa.Integer(), nullable=False, default=0),
        sa.Column('row_index', sa.Integer(), nullable=False, default=0),
        sa.Column('status', sa.String(), nullable=False, default='planned'),
        sa.Column('is_manually_positioned', sa.Boolean(), nullable=False, default=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('color_override', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        # Index for efficient querying by item
        op.create_index('ix_roadmap_item_segments_item_id', 'roadmap_item_segments', ['item_id'])
        # Index for efficient querying by session (via item join) and team
        op.create_index('ix_roadmap_item_segments_team_sprint', 'roadmap_item_segments', ['assigned_team', 'start_sprint'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_roadmap_item_segments_team_sprint', 'roadmap_item_segments')
    op.drop_index('ix_roadmap_item_segments_item_id', 'roadmap_item_segments')
    op.drop_table('roadmap_item_segments')
