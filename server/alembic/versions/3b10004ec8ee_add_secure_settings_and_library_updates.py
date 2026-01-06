"""Add secure settings and library updates

Revision ID: 3b10004ec8ee
Revises: fb0f60cc444c
Create Date: 2025-12-24 08:23:46.343527

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import sqlmodel
import sqlmodel.sql.sqltypes

# revision identifiers, used by Alembic.
revision: str = '3b10004ec8ee'
down_revision: Union[str, Sequence[str], None] = 'fb0f60cc444c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    existing_tables = inspector.get_table_names()

    if 'system_settings' not in existing_tables:
        op.create_table('system_settings',
    sa.Column('key', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('value', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
    sa.Column('is_encrypted', sa.Boolean(), nullable=False),
    sa.Column('description', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('updated_at', sa.DateTime(), nullable=False),
    sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_system_settings_key'), 'system_settings', ['key'], unique=True)
    if 'library_book_versions' not in existing_tables:
        op.create_table('library_book_versions',
    sa.Column('book_id', sa.Integer(), nullable=False),
    sa.Column('version_number', sa.Integer(), nullable=False),
    sa.Column('content_snapshot', sa.JSON(), nullable=True),
    sa.Column('commit_hash', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('change_summary', sqlmodel.sql.sqltypes.AutoString(), nullable=True),
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=False),
    sa.ForeignKeyConstraint(['book_id'], ['library_books.id'], ),
    sa.PrimaryKeyConstraint('id')
        )
    # op.drop_index(op.f('ix_goal_sessions_user_id'), table_name='goal_sessions')
    # op.drop_table('goal_sessions')
    # op.drop_index(op.f('ix_prioritized_ideas_generated_idea_id'), table_name='prioritized_ideas')
    # op.drop_index(op.f('ix_prioritized_ideas_prioritization_session_id'), table_name='prioritized_ideas')
    # op.drop_table('prioritized_ideas')
    # op.drop_index(op.f('ix_user_goals_session_id'), table_name='user_goals')
    # op.drop_index(op.f('ix_user_goals_user_id'), table_name='user_goals')
    # op.drop_table('user_goals')
    # op.drop_index(op.f('ix_prioritization_sessions_ideation_session_id'), table_name='prioritization_sessions')
    # op.drop_index(op.f('ix_prioritization_sessions_user_id'), table_name='prioritization_sessions')
    # op.drop_table('prioritization_sessions')

    # Wrap all alter_column in try/except for idempotency - these are optional type changes
    try:
        op.alter_column('feasibility_sessions', 'feature_description',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=False)
    except Exception:
        pass
    try:
        op.alter_column('generated_ideas', 'description',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=False)
    op.alter_column('generated_ideas', 'effort_estimate',
               existing_type=sa.VARCHAR(length=20),
               nullable=False,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('generated_ideas', 'impact_estimate',
               existing_type=sa.VARCHAR(length=20),
               nullable=False,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('generated_ideas', 'impact_rationale',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'feasibility_rationale',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'effort_rationale',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'strategic_fit_rationale',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'risk_rationale',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'is_duplicate',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('false'))
    op.alter_column('generated_ideas', 'is_final',
               existing_type=sa.BOOLEAN(),
               nullable=False,
               existing_server_default=sa.text('true'))
    op.alter_column('generated_ideas', 'display_order',
               existing_type=sa.INTEGER(),
               nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('generated_ideas', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('generated_ideas', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.drop_constraint(op.f('generated_ideas_session_id_fkey'), 'generated_ideas', type_='foreignkey')
    op.create_foreign_key(None, 'generated_ideas', 'ideation_sessions', ['session_id'], ['id'])
    op.alter_column('idea_clusters', 'theme_description',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('idea_clusters', 'idea_count',
               existing_type=sa.INTEGER(),
               nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('idea_clusters', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.drop_constraint(op.f('idea_clusters_session_id_fkey'), 'idea_clusters', type_='foreignkey')
    op.create_foreign_key(None, 'idea_clusters', 'ideation_sessions', ['session_id'], ['id'])
    op.alter_column('ideation_sessions', 'problem_statement',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=False)
    op.alter_column('ideation_sessions', 'constraints',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'goals',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'research_insights',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'status',
               existing_type=sa.VARCHAR(length=50),
               nullable=False,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('ideation_sessions', 'progress_step',
               existing_type=sa.INTEGER(),
               nullable=False,
               existing_server_default=sa.text('0'))
    op.alter_column('ideation_sessions', 'progress_message',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'error_message',
               existing_type=sa.TEXT(),
               type_=sqlmodel.sql.sqltypes.AutoString(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'confidence',
               existing_type=sa.VARCHAR(length=20),
               nullable=False,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('ideation_sessions', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('ideation_sessions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=False,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.create_index(op.f('ix_ideation_sessions_prioritization_session_id'), 'ideation_sessions', ['prioritization_session_id'], unique=False)
    op.create_foreign_key(None, 'ideation_sessions', 'users', ['user_id'], ['id'])
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_constraint(None, 'ideation_sessions', type_='foreignkey')
    op.drop_index(op.f('ix_ideation_sessions_prioritization_session_id'), table_name='ideation_sessions')
    op.alter_column('ideation_sessions', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('ideation_sessions', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('ideation_sessions', 'confidence',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('ideation_sessions', 'error_message',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'progress_message',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'progress_step',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('ideation_sessions', 'status',
               existing_type=sa.VARCHAR(length=50),
               nullable=True,
               existing_server_default=sa.text("'pending'::character varying"))
    op.alter_column('ideation_sessions', 'research_insights',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'goals',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'constraints',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('ideation_sessions', 'problem_statement',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=False)
    op.drop_constraint(None, 'idea_clusters', type_='foreignkey')
    op.create_foreign_key(op.f('idea_clusters_session_id_fkey'), 'idea_clusters', 'ideation_sessions', ['session_id'], ['id'], ondelete='CASCADE')
    op.alter_column('idea_clusters', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('idea_clusters', 'idea_count',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('idea_clusters', 'theme_description',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.drop_constraint(None, 'generated_ideas', type_='foreignkey')
    op.create_foreign_key(op.f('generated_ideas_session_id_fkey'), 'generated_ideas', 'ideation_sessions', ['session_id'], ['id'], ondelete='CASCADE')
    op.alter_column('generated_ideas', 'updated_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('generated_ideas', 'created_at',
               existing_type=postgresql.TIMESTAMP(),
               nullable=True,
               existing_server_default=sa.text('CURRENT_TIMESTAMP'))
    op.alter_column('generated_ideas', 'display_order',
               existing_type=sa.INTEGER(),
               nullable=True,
               existing_server_default=sa.text('0'))
    op.alter_column('generated_ideas', 'is_final',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('true'))
    op.alter_column('generated_ideas', 'is_duplicate',
               existing_type=sa.BOOLEAN(),
               nullable=True,
               existing_server_default=sa.text('false'))
    op.alter_column('generated_ideas', 'risk_rationale',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'strategic_fit_rationale',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'effort_rationale',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'feasibility_rationale',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'impact_rationale',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=True)
    op.alter_column('generated_ideas', 'impact_estimate',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('generated_ideas', 'effort_estimate',
               existing_type=sa.VARCHAR(length=20),
               nullable=True,
               existing_server_default=sa.text("'medium'::character varying"))
    op.alter_column('generated_ideas', 'description',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=False)
    op.alter_column('feasibility_sessions', 'feature_description',
               existing_type=sqlmodel.sql.sqltypes.AutoString(),
               type_=sa.TEXT(),
               existing_nullable=False)
    # op.create_table('prioritization_sessions', ...) skipped
    # op.create_table('user_goals', ...) skipped
    # op.create_table('prioritized_ideas', ...) skipped
    # op.create_table('goal_sessions', ...) skipped
    op.create_index(op.f('ix_goal_sessions_user_id'), 'goal_sessions', ['user_id'], unique=False)
    # op.drop_table('library_book_versions')
    # op.drop_index(op.f('ix_system_settings_key'), table_name='system_settings')
    # op.drop_table('system_settings')
    # ### end Alembic commands ###
