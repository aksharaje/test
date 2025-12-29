"""make_to_item_id_nullable_in_dependencies

Revision ID: f6f5ed519d20
Revises: 7299ef8b2376
Create Date: 2025-12-29 14:52:33.390065

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f6f5ed519d20'
down_revision: Union[str, Sequence[str], None] = '7299ef8b2376'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make to_item_id nullable to support external prerequisites (no target item)."""
    # Make to_item_id nullable - external prerequisites use NULL instead of 0
    op.alter_column(
        'roadmap_dependencies',
        'to_item_id',
        existing_type=sa.Integer(),
        nullable=True
    )


def downgrade() -> None:
    """Revert to_item_id to non-nullable."""
    # Note: This will fail if there are NULL values in the column
    op.alter_column(
        'roadmap_dependencies',
        'to_item_id',
        existing_type=sa.Integer(),
        nullable=False
    )
