"""update goal setting fields

Revision ID: update_goal_fields
Revises: add_pm_workflow_tables
Create Date: 2025-12-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'update_goal_fields'
down_revision: Union[str, Sequence[str], None] = 'add_pm_workflow_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Update goal_setting_sessions to use new field names."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('goal_setting_sessions')]

    # Add new columns if they don't exist
    if 'domain' not in columns:
        op.add_column('goal_setting_sessions', sa.Column('domain', sa.String(), nullable=True))
    if 'strategy' not in columns:
        op.add_column('goal_setting_sessions', sa.Column('strategy', sa.String(), nullable=True))
    if 'team_charter' not in columns:
        op.add_column('goal_setting_sessions', sa.Column('team_charter', sa.String(), nullable=True))
    if 'problem_statements' not in columns:
        op.add_column('goal_setting_sessions', sa.Column('problem_statements', sa.String(), nullable=True))
    if 'baselines' not in columns:
        op.add_column('goal_setting_sessions', sa.Column('baselines', sa.String(), nullable=True))

    # Migrate data from old columns to new columns (only if old columns exist)
    if 'context' in columns:
        op.execute("""
            UPDATE goal_setting_sessions
            SET domain = COALESCE(context, ''),
                strategy = COALESCE(timeframe, '')
            WHERE domain IS NULL OR domain = ''
        """)

    # Make required columns non-nullable (wrap in try/except)
    try:
        op.alter_column('goal_setting_sessions', 'domain', nullable=False, server_default='')
        op.alter_column('goal_setting_sessions', 'strategy', nullable=False, server_default='')
    except Exception:
        pass

    # Drop old columns if they exist
    if 'context' in columns:
        op.drop_column('goal_setting_sessions', 'context')
    if 'timeframe' in columns:
        op.drop_column('goal_setting_sessions', 'timeframe')
    if 'stakeholders' in columns:
        op.drop_column('goal_setting_sessions', 'stakeholders')
    if 'constraints' in columns:
        op.drop_column('goal_setting_sessions', 'constraints')


def downgrade() -> None:
    """Revert to old field names."""
    # Add old columns back
    op.add_column('goal_setting_sessions', sa.Column('context', sa.String(), nullable=True))
    op.add_column('goal_setting_sessions', sa.Column('timeframe', sa.String(), nullable=True))
    op.add_column('goal_setting_sessions', sa.Column('stakeholders', sa.String(), nullable=True))
    op.add_column('goal_setting_sessions', sa.Column('constraints', sa.String(), nullable=True))

    # Migrate data back
    op.execute("""
        UPDATE goal_setting_sessions
        SET context = COALESCE(domain, ''),
            timeframe = COALESCE(strategy, '')
    """)

    # Make context non-nullable
    op.alter_column('goal_setting_sessions', 'context', nullable=False)

    # Drop new columns
    op.drop_column('goal_setting_sessions', 'domain')
    op.drop_column('goal_setting_sessions', 'strategy')
    op.drop_column('goal_setting_sessions', 'team_charter')
    op.drop_column('goal_setting_sessions', 'problem_statements')
    op.drop_column('goal_setting_sessions', 'baselines')
