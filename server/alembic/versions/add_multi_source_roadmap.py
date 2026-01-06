"""Add multi-source support to roadmap_sessions and source_type to roadmap_items

Revision ID: add_multi_source_roadmap
Revises: add_team_count_roadmap
Create Date: 2025-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_multi_source_roadmap'
down_revision: Union[str, None] = 'add_team_count_roadmap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    # Add new source columns to roadmap_sessions
    session_cols = [col['name'] for col in inspector.get_columns('roadmap_sessions')]
    if 'feasibility_ids' not in session_cols:
        op.add_column('roadmap_sessions', sa.Column('feasibility_ids', sa.JSON(), nullable=True, server_default='[]'))
    if 'ideation_ids' not in session_cols:
        op.add_column('roadmap_sessions', sa.Column('ideation_ids', sa.JSON(), nullable=True, server_default='[]'))
    if 'custom_items' not in session_cols:
        op.add_column('roadmap_sessions', sa.Column('custom_items', sa.JSON(), nullable=True, server_default='[]'))

    # Add source_type to roadmap_items
    item_cols = [col['name'] for col in inspector.get_columns('roadmap_items')]
    if 'source_type' not in item_cols:
        op.add_column('roadmap_items', sa.Column('source_type', sa.String(), nullable=False, server_default='artifact'))


def downgrade() -> None:
    # Remove source_type from roadmap_items
    op.drop_column('roadmap_items', 'source_type')

    # Remove new source columns from roadmap_sessions
    op.drop_column('roadmap_sessions', 'custom_items')
    op.drop_column('roadmap_sessions', 'ideation_ids')
    op.drop_column('roadmap_sessions', 'feasibility_ids')
