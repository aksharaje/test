"""add_market_research_sessions

Revision ID: 2e97e37c043d
Revises: 29e0ff1ebe7f
Create Date: 2025-12-31 09:24:39.420808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2e97e37c043d'
down_revision: Union[str, Sequence[str], None] = '29e0ff1ebe7f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create market_research_sessions table."""
    # Check if table already exists
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'market_research_sessions')")
    )
    exists = result.scalar()

    if not exists:
        op.create_table('market_research_sessions',
            sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
            sa.Column('problem_area', sa.String(), nullable=False),
            sa.Column('industry_context', sa.String(), nullable=False),
            sa.Column('focus_areas', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('status', sa.String(), nullable=False),
            sa.Column('error_message', sa.String(), nullable=True),
            sa.Column('executive_summary', sa.String(), nullable=True),
            sa.Column('market_trends', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('expectation_shifts', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('market_risks', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('implications', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    """Drop market_research_sessions table."""
    op.drop_table('market_research_sessions')
