"""add_user_id_to_market_research_and_competitive_analysis

Revision ID: a8880d488541
Revises: a74cc998fe45
Create Date: 2026-01-05 09:36:57.376524

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8880d488541'
down_revision: Union[str, Sequence[str], None] = 'a74cc998fe45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    # Add user_id to market_research_sessions
    mr_columns = [col['name'] for col in inspector.get_columns('market_research_sessions')]
    if 'user_id' not in mr_columns:
        op.add_column(
            'market_research_sessions',
            sa.Column('user_id', sa.Integer(), nullable=True)
        )
        try:
            op.create_foreign_key(
                'fk_market_research_sessions_user_id',
                'market_research_sessions',
                'users',
                ['user_id'],
                ['id']
            )
        except Exception:
            pass

    # Add user_id to competitive_analysis_sessions
    ca_columns = [col['name'] for col in inspector.get_columns('competitive_analysis_sessions')]
    if 'user_id' not in ca_columns:
        op.add_column(
            'competitive_analysis_sessions',
            sa.Column('user_id', sa.Integer(), nullable=True)
        )
        try:
            op.create_foreign_key(
                'fk_competitive_analysis_sessions_user_id',
                'competitive_analysis_sessions',
                'users',
                ['user_id'],
                ['id']
            )
        except Exception:
            pass


def downgrade() -> None:
    """Downgrade schema."""
    # Remove user_id from competitive_analysis_sessions
    op.drop_constraint(
        'fk_competitive_analysis_sessions_user_id',
        'competitive_analysis_sessions',
        type_='foreignkey'
    )
    op.drop_column('competitive_analysis_sessions', 'user_id')

    # Remove user_id from market_research_sessions
    op.drop_constraint(
        'fk_market_research_sessions_user_id',
        'market_research_sessions',
        type_='foreignkey'
    )
    op.drop_column('market_research_sessions', 'user_id')
