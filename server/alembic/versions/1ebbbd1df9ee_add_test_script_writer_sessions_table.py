"""add_test_script_writer_sessions_table

Revision ID: 1ebbbd1df9ee
Revises: f018793a73c7
Create Date: 2025-12-31 11:18:06.203424

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '1ebbbd1df9ee'
down_revision: Union[str, Sequence[str], None] = 'f018793a73c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create test_script_writer_sessions table."""
    op.create_table(
        'test_script_writer_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('source_type', sa.String(), nullable=False, server_default='manual'),
        sa.Column('source_id', sa.Integer(), nullable=True),
        sa.Column('source_title', sa.String(), nullable=True),
        sa.Column('stories', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('selected_nfrs', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.String(), nullable=True),
        sa.Column('story_test_scripts', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('summary', sa.String(), nullable=True),
        sa.Column('total_test_cases', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('test_breakdown', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Drop test_script_writer_sessions table."""
    op.drop_table('test_script_writer_sessions')
