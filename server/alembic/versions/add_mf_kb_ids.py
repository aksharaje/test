"""add_knowledge_base_ids_to_measurement_framework

Revision ID: add_mf_kb_ids
Revises: d6f0472fbc4c
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_mf_kb_ids'
down_revision: Union[str, Sequence[str], None] = 'd6f0472fbc4c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('measurement_framework_sessions',
                  sa.Column('knowledge_base_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('measurement_framework_sessions', 'knowledge_base_ids')
