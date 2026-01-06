"""Add context sources to research planner

Revision ID: a52c3e7d6ea5
Revises: 707ed95e254d
Create Date: 2025-12-26 06:43:54.884203

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a52c3e7d6ea5'
down_revision: Union[str, Sequence[str], None] = '707ed95e254d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    # Check if table exists first
    existing_tables = inspector.get_table_names()
    if 'research_plan_sessions' not in existing_tables:
        return

    columns = [col['name'] for col in inspector.get_columns('research_plan_sessions')]

    # Add context source columns to research_plan_sessions
    if 'knowledge_base_ids' not in columns:
        op.add_column('research_plan_sessions', sa.Column('knowledge_base_ids', sa.JSON(), nullable=True))
    if 'ideation_session_id' not in columns:
        op.add_column('research_plan_sessions', sa.Column('ideation_session_id', sa.Integer(), nullable=True))
    if 'feasibility_session_id' not in columns:
        op.add_column('research_plan_sessions', sa.Column('feasibility_session_id', sa.Integer(), nullable=True))
    if 'business_case_session_id' not in columns:
        op.add_column('research_plan_sessions', sa.Column('business_case_session_id', sa.Integer(), nullable=True))
    if 'context_summary' not in columns:
        op.add_column('research_plan_sessions', sa.Column('context_summary', sa.JSON(), nullable=True))

    # Get existing foreign keys to check before creating
    existing_fks = [fk['name'] for fk in inspector.get_foreign_keys('research_plan_sessions')]

    # Add foreign key constraints only if they don't exist
    if 'fk_research_plan_sessions_business_case' not in existing_fks and 'business_case_sessions' in existing_tables:
        op.create_foreign_key(
            'fk_research_plan_sessions_business_case',
            'research_plan_sessions',
            'business_case_sessions',
            ['business_case_session_id'],
            ['id']
        )
    if 'fk_research_plan_sessions_ideation' not in existing_fks and 'ideation_sessions' in existing_tables:
        op.create_foreign_key(
            'fk_research_plan_sessions_ideation',
            'research_plan_sessions',
            'ideation_sessions',
            ['ideation_session_id'],
            ['id']
        )
    if 'fk_research_plan_sessions_feasibility' not in existing_fks and 'feasibility_sessions' in existing_tables:
        op.create_foreign_key(
            'fk_research_plan_sessions_feasibility',
            'research_plan_sessions',
            'feasibility_sessions',
            ['feasibility_session_id'],
            ['id']
        )


def downgrade() -> None:
    """Downgrade schema."""
    # Drop foreign key constraints
    op.drop_constraint('fk_research_plan_sessions_feasibility', 'research_plan_sessions', type_='foreignkey')
    op.drop_constraint('fk_research_plan_sessions_ideation', 'research_plan_sessions', type_='foreignkey')
    op.drop_constraint('fk_research_plan_sessions_business_case', 'research_plan_sessions', type_='foreignkey')

    # Drop columns
    op.drop_column('research_plan_sessions', 'context_summary')
    op.drop_column('research_plan_sessions', 'business_case_session_id')
    op.drop_column('research_plan_sessions', 'feasibility_session_id')
    op.drop_column('research_plan_sessions', 'ideation_session_id')
    op.drop_column('research_plan_sessions', 'knowledge_base_ids')
