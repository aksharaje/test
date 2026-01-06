"""add kpi assignment tables

Revision ID: add_kpi_assignment
Revises: update_goal_fields
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_kpi_assignment'
down_revision: Union[str, Sequence[str], None] = 'update_goal_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create KPI assignment tables."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    # Create kpi_assignment_sessions table
    if 'kpi_assignment_sessions' not in existing_tables:
        op.create_table(
            'kpi_assignment_sessions',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('okr_session_id', sa.Integer(), sa.ForeignKey('okr_sessions.id'), nullable=False),
            sa.Column('status', sa.String(), nullable=False, server_default='draft'),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
        )

    # Create kpi_assignments table
    if 'kpi_assignments' not in existing_tables:
        op.create_table(
            'kpi_assignments',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('session_id', sa.Integer(), sa.ForeignKey('kpi_assignment_sessions.id'), nullable=False),
            sa.Column('key_result_id', sa.Integer(), sa.ForeignKey('okr_key_results.id'), nullable=False),
            sa.Column('primary_kpi', sa.String(), nullable=False),
            sa.Column('measurement_unit', sa.String(), nullable=False),
            sa.Column('secondary_kpi', sa.String(), nullable=True),
            sa.Column('check_frequency', sa.String(), nullable=False, server_default='weekly'),
            sa.Column('metric_suggestions', sa.JSON(), nullable=True),
            sa.Column('notes', sa.String(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )


def downgrade() -> None:
    """Drop KPI assignment tables."""
    op.drop_table('kpi_assignments')
    op.drop_table('kpi_assignment_sessions')
