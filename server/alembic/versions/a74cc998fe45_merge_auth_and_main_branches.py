"""merge auth and main branches

Revision ID: a74cc998fe45
Revises: a4922e39be85, f9a2c4d5e6b7
Create Date: 2025-12-31 15:45:26.774593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a74cc998fe45'
down_revision: Union[str, Sequence[str], None] = ('a4922e39be85', 'f9a2c4d5e6b7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
