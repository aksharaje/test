"""add_is_shared_to_knowledge_bases

Revision ID: 24e86c04a211
Revises: e8927145a657
Create Date: 2026-01-05 14:09:33.858733

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '24e86c04a211'
down_revision: Union[str, Sequence[str], None] = 'e8927145a657'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('knowledge_bases')]
    if 'is_shared' not in columns:
        op.add_column('knowledge_bases', sa.Column('is_shared', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('knowledge_bases', 'is_shared')
