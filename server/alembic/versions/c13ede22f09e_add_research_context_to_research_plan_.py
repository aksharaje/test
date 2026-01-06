"""Add research_context to research_plan_sessions

Revision ID: c13ede22f09e
Revises: a52c3e7d6ea5
Create Date: 2025-12-26 08:19:54.434798

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c13ede22f09e'
down_revision: Union[str, Sequence[str], None] = 'a52c3e7d6ea5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('research_plan_sessions')]
    if 'research_context' not in columns:
        op.add_column('research_plan_sessions', sa.Column('research_context', sa.String(), nullable=True, server_default='b2b'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('research_plan_sessions', 'research_context')
