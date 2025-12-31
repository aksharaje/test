"""Add competitive analysis tables

Revision ID: add_competitive_analysis
Revises:
Create Date: 2024-01-01

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_competitive_analysis'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Idempotent migration for competitive analysis tables.
    Safe to run multiple times - checks for existence before each operation.
    """
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if 'competitive_analysis_sessions' not in inspector.get_table_names():
        # Create fresh table with all current columns
        op.create_table(
            'competitive_analysis_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('focus_area', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default=''),
            sa.Column('custom_focus_area', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('reference_competitors', sa.JSON(), nullable=True),
            sa.Column('include_best_in_class', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('include_adjacent_industries', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('target_industry', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('input_source_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('input_source_id', sa.Integer(), nullable=True),
            sa.Column('input_source_description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('knowledge_base_id', sa.Integer(), nullable=True),
            sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='pending'),
            sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('industry_standards', sa.JSON(), nullable=True),
            sa.Column('best_practices', sa.JSON(), nullable=True),
            sa.Column('common_pitfalls', sa.JSON(), nullable=True),
            sa.Column('product_gaps', sa.JSON(), nullable=True),
            sa.Column('opportunities', sa.JSON(), nullable=True),
            sa.Column('code_comparison', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )
    else:
        # Table exists - apply incremental migrations
        columns = [c['name'] for c in inspector.get_columns('competitive_analysis_sessions')]

        # Migrate problem_area -> focus_area
        if 'focus_area' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('focus_area', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default=''))
            if 'problem_area' in columns:
                op.execute("UPDATE competitive_analysis_sessions SET focus_area = problem_area WHERE focus_area = '' OR focus_area IS NULL")

        # Migrate custom_problem_area -> custom_focus_area
        if 'custom_focus_area' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('custom_focus_area', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
            if 'custom_problem_area' in columns:
                op.execute("UPDATE competitive_analysis_sessions SET custom_focus_area = custom_problem_area WHERE custom_focus_area IS NULL AND custom_problem_area IS NOT NULL")

        # Add new columns if missing
        if 'knowledge_base_id' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('knowledge_base_id', sa.Integer(), nullable=True))

        if 'code_comparison' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('code_comparison', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

        if 'target_industry' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('target_industry', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

        if 'input_source_type' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('input_source_type', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

        if 'input_source_id' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('input_source_id', sa.Integer(), nullable=True))

        if 'input_source_description' not in columns:
            op.add_column('competitive_analysis_sessions',
                sa.Column('input_source_description', sqlmodel.sql.sqltypes.AutoString(), nullable=True))

        # Remove deprecated columns (refresh column list after additions)
        columns = [c['name'] for c in inspector.get_columns('competitive_analysis_sessions')]

        if 'problem_area' in columns and 'focus_area' in columns:
            op.drop_column('competitive_analysis_sessions', 'problem_area')

        if 'custom_problem_area' in columns and 'custom_focus_area' in columns:
            op.drop_column('competitive_analysis_sessions', 'custom_problem_area')

        if 'include_direct_competitors' in columns:
            op.drop_column('competitive_analysis_sessions', 'include_direct_competitors')


def downgrade() -> None:
    op.drop_table('competitive_analysis_sessions')
