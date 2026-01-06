"""add_knowledge_base_ids_to_release_prep

Revision ID: manual_add_kb_ids
Revises: 54c7269b082e
Create Date: 2025-12-29

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'manual_add_kb_ids'
down_revision: Union[str, Sequence[str], None] = '54c7269b082e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('release_prep_sessions')]
    if 'knowledge_base_ids' not in columns:
        op.add_column('release_prep_sessions',
                      sa.Column('knowledge_base_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('release_prep_sessions', 'knowledge_base_ids')
