"""add_context_fields_to_scope_definition

Revision ID: add_scope_context
Revises: add_mf_kb_ids
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = 'add_scope_context'
down_revision: Union[str, Sequence[str], None] = 'add_mf_kb_ids'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('scope_definition_sessions',
                  sa.Column('ideation_session_id', sa.Integer(), sa.ForeignKey('ideation_sessions.id'), nullable=True))
    op.add_column('scope_definition_sessions',
                  sa.Column('okr_session_id', sa.Integer(), sa.ForeignKey('okr_sessions.id'), nullable=True))
    op.add_column('scope_definition_sessions',
                  sa.Column('knowledge_base_ids', postgresql.JSON(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('scope_definition_sessions', 'knowledge_base_ids')
    op.drop_column('scope_definition_sessions', 'okr_session_id')
    op.drop_column('scope_definition_sessions', 'ideation_session_id')
