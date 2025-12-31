"""add_focus_area_source_fields_to_competitive_analysis

Revision ID: f7ff4078b625
Revises: 2e97e37c043d
Create Date: 2025-12-31 09:56:37.221466

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f7ff4078b625'
down_revision: Union[str, Sequence[str], None] = '2e97e37c043d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add focus area source fields to competitive_analysis_sessions
    op.add_column('competitive_analysis_sessions',
        sa.Column('focus_area_source_type', sa.String(), nullable=True))
    op.add_column('competitive_analysis_sessions',
        sa.Column('focus_area_source_id', sa.Integer(), nullable=True))
    op.add_column('competitive_analysis_sessions',
        sa.Column('focus_area_context', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('competitive_analysis_sessions', 'focus_area_context')
    op.drop_column('competitive_analysis_sessions', 'focus_area_source_id')
    op.drop_column('competitive_analysis_sessions', 'focus_area_source_type')
