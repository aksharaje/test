"""Add assigned_team column to roadmap_items

Revision ID: add_assigned_team_roadmap
Revises: add_multi_source_roadmap
Create Date: 2025-01-02 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_assigned_team_roadmap'
down_revision: Union[str, None] = 'add_multi_source_roadmap'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add assigned_team column to roadmap_items
    op.add_column('roadmap_items', sa.Column('assigned_team', sa.Integer(), nullable=True))


def downgrade() -> None:
    # Remove assigned_team from roadmap_items
    op.drop_column('roadmap_items', 'assigned_team')
