"""Add sprint_span column to roadmap_items

Revision ID: add_sprint_span_roadmap
Revises: add_assigned_team_roadmap
Create Date: 2025-01-02 01:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_sprint_span_roadmap'
down_revision: Union[str, None] = 'add_assigned_team_roadmap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('roadmap_items')]
    if 'sprint_span' not in columns:
        op.add_column('roadmap_items', sa.Column('sprint_span', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    # Remove sprint_span from roadmap_items
    op.drop_column('roadmap_items', 'sprint_span')
