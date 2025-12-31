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
    # Check if table already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'competitive_analysis_sessions' not in inspector.get_table_names():
        op.create_table(
            'competitive_analysis_sessions',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('problem_area', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
            sa.Column('custom_problem_area', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('reference_competitors', sa.JSON(), nullable=True),
            sa.Column('include_direct_competitors', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('include_best_in_class', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('include_adjacent_industries', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False, server_default='pending'),
            sa.Column('error_message', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('executive_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
            sa.Column('industry_standards', sa.JSON(), nullable=True),
            sa.Column('best_practices', sa.JSON(), nullable=True),
            sa.Column('common_pitfalls', sa.JSON(), nullable=True),
            sa.Column('product_gaps', sa.JSON(), nullable=True),
            sa.Column('opportunities', sa.JSON(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.PrimaryKeyConstraint('id')
        )


def downgrade() -> None:
    op.drop_table('competitive_analysis_sessions')
