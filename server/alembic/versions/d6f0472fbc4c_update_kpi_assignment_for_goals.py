"""update_kpi_assignment_for_goals

Revision ID: d6f0472fbc4c
Revises: 541cd54f7a35
Create Date: 2025-12-30 19:04:51.695788

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd6f0472fbc4c'
down_revision: Union[str, Sequence[str], None] = '541cd54f7a35'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Update kpi_assignment_sessions table
    op.add_column('kpi_assignment_sessions', sa.Column('goal_session_id', sa.Integer(), nullable=True))
    op.add_column('kpi_assignment_sessions', sa.Column('progress_message', sa.String(), nullable=True))
    op.add_column('kpi_assignment_sessions', sa.Column('error_message', sa.String(), nullable=True))
    op.add_column('kpi_assignment_sessions', sa.Column('executive_summary', sa.String(), nullable=True))
    op.add_column('kpi_assignment_sessions', sa.Column('generation_metadata', sa.JSON(), nullable=True))

    # Make okr_session_id nullable
    op.alter_column('kpi_assignment_sessions', 'okr_session_id',
                    existing_type=sa.Integer(),
                    nullable=True)

    # Update kpi_assignments table
    op.add_column('kpi_assignments', sa.Column('goal_id', sa.Integer(), nullable=True))
    op.add_column('kpi_assignments', sa.Column('goal_title', sa.String(), nullable=True))
    op.add_column('kpi_assignments', sa.Column('goal_category', sa.String(), nullable=True))
    op.add_column('kpi_assignments', sa.Column('alternative_kpis', sa.JSON(), nullable=True))
    op.add_column('kpi_assignments', sa.Column('rationale', sa.String(), nullable=True))
    op.add_column('kpi_assignments', sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'))

    # Make key_result_id nullable
    op.alter_column('kpi_assignments', 'key_result_id',
                    existing_type=sa.Integer(),
                    nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Revert kpi_assignments
    op.drop_column('kpi_assignments', 'display_order')
    op.drop_column('kpi_assignments', 'rationale')
    op.drop_column('kpi_assignments', 'alternative_kpis')
    op.drop_column('kpi_assignments', 'goal_category')
    op.drop_column('kpi_assignments', 'goal_title')
    op.drop_column('kpi_assignments', 'goal_id')

    # Revert kpi_assignment_sessions
    op.drop_column('kpi_assignment_sessions', 'generation_metadata')
    op.drop_column('kpi_assignment_sessions', 'executive_summary')
    op.drop_column('kpi_assignment_sessions', 'error_message')
    op.drop_column('kpi_assignment_sessions', 'progress_message')
    op.drop_column('kpi_assignment_sessions', 'goal_session_id')
