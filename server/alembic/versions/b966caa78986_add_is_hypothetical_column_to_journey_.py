"""Add is_hypothetical column to journey_pain_points

Revision ID: b966caa78986
Revises: 580365840fe0
Create Date: 2025-12-26 11:38:45.867491

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b966caa78986'
down_revision: Union[str, Sequence[str], None] = '580365840fe0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_hypothetical column to journey_pain_points."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('journey_pain_points')]
    if 'is_hypothetical' not in columns:
        op.add_column(
            'journey_pain_points',
            sa.Column('is_hypothetical', sa.Boolean(), nullable=False, server_default='false')
        )


def downgrade() -> None:
    """Remove is_hypothetical column."""
    op.drop_column('journey_pain_points', 'is_hypothetical')
