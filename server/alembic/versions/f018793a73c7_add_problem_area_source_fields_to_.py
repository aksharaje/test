"""add_problem_area_source_fields_to_market_research

Revision ID: f018793a73c7
Revises: f7ff4078b625
Create Date: 2025-12-31 10:03:02.194785

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f018793a73c7'
down_revision: Union[str, Sequence[str], None] = 'f7ff4078b625'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('market_research_sessions')]

    if 'problem_area_source_type' not in columns:
        op.add_column('market_research_sessions',
            sa.Column('problem_area_source_type', sa.String(), nullable=True))
    if 'problem_area_source_id' not in columns:
        op.add_column('market_research_sessions',
            sa.Column('problem_area_source_id', sa.Integer(), nullable=True))
    if 'problem_area_context' not in columns:
        op.add_column('market_research_sessions',
            sa.Column('problem_area_context', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('market_research_sessions', 'problem_area_context')
    op.drop_column('market_research_sessions', 'problem_area_source_id')
    op.drop_column('market_research_sessions', 'problem_area_source_type')
