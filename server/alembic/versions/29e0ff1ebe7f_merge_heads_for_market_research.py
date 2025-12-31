"""merge_heads_for_market_research

Revision ID: 29e0ff1ebe7f
Revises: add_competitive_analysis, add_scope_context
Create Date: 2025-12-31 09:24:11.449257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29e0ff1ebe7f'
down_revision: Union[str, Sequence[str], None] = ('add_competitive_analysis', 'add_scope_context')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
