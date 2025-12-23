"""Add sourceMetadata to KnowledgeBase

Revision ID: 0e9c4a51f89b
Revises: 0b1cb4eb912d
Create Date: 2025-12-22 11:45:47.908963

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = '0e9c4a51f89b'
down_revision: Union[str, Sequence[str], None] = '0b1cb4eb912d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('knowledge_bases', sa.Column('source_metadata', sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('knowledge_bases', 'source_metadata')
