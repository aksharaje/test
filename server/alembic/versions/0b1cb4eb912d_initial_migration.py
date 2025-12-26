"""Initial migration

Revision ID: 0b1cb4eb912d
Revises:
Create Date: 2025-12-05 17:59:51.359649

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0b1cb4eb912d'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema - create all tables."""
    # Create core tables first (users, agents, etc.)
    
    # Users
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # Users
    if 'users' not in existing_tables:
        op.create_table('users',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('email', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True)
    
    # Agents
    if 'agents' not in existing_tables:
        op.create_table('agents',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('description', sa.VARCHAR(), nullable=True),
        sa.Column('system_prompt', sa.VARCHAR(), nullable=False),
        sa.Column('model', sa.VARCHAR(), nullable=False),
        sa.Column('tools', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )
    
    # Flows
    if 'flows' not in existing_tables:
        op.create_table('flows',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('description', sa.VARCHAR(), nullable=True),
        sa.Column('initial_state', sa.VARCHAR(), nullable=False),
        sa.Column('states', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    if 'flow_executions' not in existing_tables:
        op.create_table('flow_executions',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('flow_id', sa.INTEGER(), nullable=False),
        sa.Column('current_state', sa.VARCHAR(), nullable=False),
        sa.Column('status', sa.VARCHAR(), nullable=False),
        sa.Column('context', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('history', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('error', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['flow_id'], ['flows.id'], ),
        sa.PrimaryKeyConstraint('id')
        )

    # Integrations
    if 'integrations' not in existing_tables:
        op.create_table('integrations',
        sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
        sa.Column('provider', sa.VARCHAR(), nullable=False),
        sa.Column('name', sa.VARCHAR(), nullable=False),
        sa.Column('base_url', sa.VARCHAR(), nullable=False),
        sa.Column('cloud_id', sa.VARCHAR(), nullable=True),
        sa.Column('auth_type', sa.VARCHAR(), nullable=False),
        sa.Column('access_token', sa.VARCHAR(), nullable=False),
        sa.Column('refresh_token', sa.VARCHAR(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(), nullable=True),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('status', sa.VARCHAR(), nullable=False),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('error_message', sa.VARCHAR(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
        )

    op.create_table('jira_projects',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('integration_id', sa.INTEGER(), nullable=False),
    sa.Column('jira_id', sa.VARCHAR(), nullable=False),
    sa.Column('key', sa.VARCHAR(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('project_type', sa.VARCHAR(), nullable=True),
    sa.Column('avatar_url', sa.VARCHAR(), nullable=True),
    sa.Column('synced_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['integration_id'], ['integrations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Knowledge Bases
    op.create_table('knowledge_bases',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('settings', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    # source_metadata deliberately OMITTED here, to be added by next migration
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('document_count', sa.INTEGER(), nullable=False),
    sa.Column('total_chunks', sa.INTEGER(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('documents',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('knowledge_base_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('source', sa.VARCHAR(), nullable=False),
    sa.Column('source_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('content', sa.VARCHAR(), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('error', sa.VARCHAR(), nullable=True),
    sa.Column('chunk_count', sa.INTEGER(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['knowledge_base_id'], ['knowledge_bases.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    from pgvector.sqlalchemy import Vector
    op.create_table('document_chunks',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('document_id', sa.INTEGER(), nullable=False),
    sa.Column('knowledge_base_id', sa.INTEGER(), nullable=False),
    sa.Column('content', sa.VARCHAR(), nullable=False),
    sa.Column('embedding', Vector(1536), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('token_count', sa.INTEGER(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ),
    sa.ForeignKeyConstraint(['knowledge_base_id'], ['knowledge_bases.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Library
    op.create_table('library_books',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('knowledge_base_id', sa.INTEGER(), nullable=False),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('error', sa.VARCHAR(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['knowledge_base_id'], ['knowledge_bases.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('library_pages',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('book_id', sa.INTEGER(), nullable=False),
    sa.Column('parent_id', sa.INTEGER(), nullable=True),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('content', sa.VARCHAR(), nullable=False),
    sa.Column('order', sa.INTEGER(), nullable=False),
    sa.Column('type', sa.VARCHAR(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['book_id'], ['library_books.id'], ),
    sa.ForeignKeyConstraint(['parent_id'], ['library_pages.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('library_integrations',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('book_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('integration_type', sa.VARCHAR(), nullable=False),
    sa.Column('technical_details', sa.VARCHAR(), nullable=True),
    sa.Column('functional_details', sa.VARCHAR(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['book_id'], ['library_books.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    # Code Chat
    op.create_table('code_chat_sessions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('title', sa.VARCHAR(), nullable=True),
    sa.Column('knowledge_base_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('code_chat_messages',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('role', sa.VARCHAR(), nullable=False),
    sa.Column('content', sa.VARCHAR(), nullable=False),
    sa.Column('citations', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['code_chat_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Optimize & Agents
    op.create_table('prompt_versions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('agent_id', sa.INTEGER(), nullable=False),
    sa.Column('version', sa.INTEGER(), nullable=False),
    sa.Column('system_prompt', sa.VARCHAR(), nullable=False),
    sa.Column('model', sa.VARCHAR(), nullable=False),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('split_tests',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('agent_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('prompt_version_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('agent_executions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('agent_id', sa.INTEGER(), nullable=False),
    sa.Column('split_test_id', sa.INTEGER(), nullable=True),
    sa.Column('prompt_version_id', sa.INTEGER(), nullable=True),
    sa.Column('conversation_id', sa.INTEGER(), nullable=True),
    sa.Column('input_prompt', sa.VARCHAR(), nullable=False),
    sa.Column('response', sa.VARCHAR(), nullable=False),
    sa.Column('execution_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('executed_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['agent_id'], ['agents.id'], ),
    sa.ForeignKeyConstraint(['split_test_id'], ['split_tests.id'], ),
    sa.ForeignKeyConstraint(['prompt_version_id'], ['prompt_versions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('feedback',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('execution_id', sa.INTEGER(), nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('sentiment', sa.VARCHAR(), nullable=False),
    sa.Column('text', sa.VARCHAR(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['execution_id'], ['agent_executions.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Story & PRD
    op.create_table('prompt_templates',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('type', sa.VARCHAR(), nullable=False),
    sa.Column('version', sa.INTEGER(), nullable=False),
    sa.Column('system_prompt', sa.VARCHAR(), nullable=False),
    sa.Column('model', sa.VARCHAR(), nullable=False),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    op.create_table('story_generator_split_tests',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('artifact_type', sa.VARCHAR(), nullable=False),
    sa.Column('prompt_template_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('generated_artifacts',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('type', sa.VARCHAR(), nullable=False),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('content', sa.VARCHAR(), nullable=False),
    sa.Column('parent_id', sa.INTEGER(), nullable=True),
    sa.Column('input_description', sa.VARCHAR(), nullable=False),
    sa.Column('input_files', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('knowledge_base_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('prompt_template_id', sa.INTEGER(), nullable=True),
    sa.Column('split_test_id', sa.INTEGER(), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('generation_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['prompt_template_id'], ['prompt_templates.id'], ),
    sa.ForeignKeyConstraint(['split_test_id'], ['story_generator_split_tests.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('generation_feedback',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('artifact_id', sa.INTEGER(), nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('sentiment', sa.VARCHAR(), nullable=False),
    sa.Column('text', sa.VARCHAR(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['artifact_id'], ['generated_artifacts.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('prd_templates',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('is_default', sa.INTEGER(), nullable=False),
    sa.Column('is_custom', sa.INTEGER(), nullable=False),
    sa.Column('system_prompt', sa.VARCHAR(), nullable=False),
    sa.Column('json_schema', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('generated_prds',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('content', sa.VARCHAR(), nullable=False),
    sa.Column('concept', sa.VARCHAR(), nullable=False),
    sa.Column('target_project', sa.VARCHAR(), nullable=True),
    sa.Column('target_persona', sa.VARCHAR(), nullable=True),
    sa.Column('industry_context', sa.VARCHAR(), nullable=True),
    sa.Column('primary_metric', sa.VARCHAR(), nullable=True),
    sa.Column('user_story_role', sa.VARCHAR(), nullable=True),
    sa.Column('user_story_goal', sa.VARCHAR(), nullable=True),
    sa.Column('user_story_benefit', sa.VARCHAR(), nullable=True),
    sa.Column('knowledge_base_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('input_files', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('template_id', sa.INTEGER(), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('generation_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('citations', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['template_id'], ['prd_templates.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # PI Planning
    op.create_table('pi_sessions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('integration_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('project_keys', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('start_date', sa.DateTime(), nullable=True),
    sa.Column('end_date', sa.DateTime(), nullable=True),
    sa.Column('sprint_count', sa.INTEGER(), nullable=False),
    sa.Column('sprint_length_weeks', sa.INTEGER(), nullable=False),
    sa.Column('plannable_issue_type', sa.VARCHAR(), nullable=False),
    sa.Column('custom_issue_type_name', sa.VARCHAR(), nullable=True),
    sa.Column('holiday_config_id', sa.INTEGER(), nullable=True),
    sa.Column('include_ip_sprint', sa.Boolean(), nullable=False),
    sa.Column('current_version', sa.VARCHAR(), nullable=False),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('created_by', sa.INTEGER(), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['integration_id'], ['integrations.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('pi_session_boards',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('jira_board_id', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('board_type', sa.VARCHAR(), nullable=False),
    sa.Column('default_velocity', sa.INTEGER(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['pi_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('pi_sprints',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('sprint_number', sa.INTEGER(), nullable=False),
    sa.Column('name', sa.VARCHAR(), nullable=False),
    sa.Column('start_date', sa.DateTime(), nullable=False),
    sa.Column('end_date', sa.DateTime(), nullable=False),
    sa.Column('working_days', sa.INTEGER(), nullable=False),
    sa.Column('total_days', sa.INTEGER(), nullable=False),
    sa.Column('holidays', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('is_ip_sprint', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['pi_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('pi_features',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('jira_issue_id', sa.VARCHAR(), nullable=True),
    sa.Column('jira_issue_key', sa.VARCHAR(), nullable=True),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=True),
    sa.Column('issue_type', sa.VARCHAR(), nullable=True),
    sa.Column('priority', sa.VARCHAR(), nullable=True),
    sa.Column('priority_order', sa.INTEGER(), nullable=True),
    sa.Column('total_points', sa.INTEGER(), nullable=True),
    sa.Column('estimated_sprints', sa.INTEGER(), nullable=False),
    sa.Column('dependencies', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('labels', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('project_key', sa.VARCHAR(), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=True),
    sa.ForeignKeyConstraint(['session_id'], ['pi_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    
    op.create_table('pi_feature_assignments',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('feature_id', sa.INTEGER(), nullable=False),
    sa.Column('board_id', sa.INTEGER(), nullable=False),
    sa.Column('start_sprint_num', sa.INTEGER(), nullable=False),
    sa.Column('end_sprint_num', sa.INTEGER(), nullable=False),
    sa.Column('allocated_points', sa.INTEGER(), nullable=True),
    sa.Column('ai_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('is_manual_override', sa.Boolean(), nullable=False),
    sa.ForeignKeyConstraint(['feature_id'], ['pi_features.id'], ),
    sa.ForeignKeyConstraint(['board_id'], ['pi_session_boards.id'], ),
    sa.PrimaryKeyConstraint('id')
    )

    # Ideation
    op.create_table('ideation_sessions',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('user_id', sa.INTEGER(), nullable=True),
    sa.Column('problem_statement', sa.VARCHAR(), nullable=False),
    sa.Column('constraints', sa.VARCHAR(), nullable=True),
    sa.Column('goals', sa.VARCHAR(), nullable=True),
    sa.Column('research_insights', sa.VARCHAR(), nullable=True),
    sa.Column('knowledge_base_ids', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('structured_problem', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('status', sa.VARCHAR(), nullable=False),
    sa.Column('progress_step', sa.INTEGER(), nullable=False),
    sa.Column('progress_message', sa.VARCHAR(), nullable=True),
    sa.Column('error_message', sa.VARCHAR(), nullable=True),
    sa.Column('confidence', sa.VARCHAR(), nullable=False),
    sa.Column('generation_metadata', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_ideation_sessions_user_id'), 'ideation_sessions', ['user_id'], unique=False)

    op.create_table('idea_clusters',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('cluster_number', sa.INTEGER(), nullable=False),
    sa.Column('theme_name', sa.VARCHAR(), nullable=False),
    sa.Column('theme_description', sa.VARCHAR(), nullable=True),
    sa.Column('idea_count', sa.INTEGER(), nullable=False),
    sa.Column('centroid_embedding', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['ideation_sessions.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_idea_clusters_session_id'), 'idea_clusters', ['session_id'], unique=False)

    op.create_table('generated_ideas',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('session_id', sa.INTEGER(), nullable=False),
    sa.Column('title', sa.VARCHAR(), nullable=False),
    sa.Column('description', sa.VARCHAR(), nullable=False),
    sa.Column('category', sa.VARCHAR(), nullable=False),
    sa.Column('effort_estimate', sa.VARCHAR(), nullable=False),
    sa.Column('impact_estimate', sa.VARCHAR(), nullable=False),
    sa.Column('embedding', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('cluster_id', sa.INTEGER(), nullable=True),
    sa.Column('use_cases', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('edge_cases', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('implementation_notes', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('impact_score', sa.FLOAT(), nullable=True),
    sa.Column('impact_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('feasibility_score', sa.FLOAT(), nullable=True),
    sa.Column('feasibility_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('effort_score', sa.FLOAT(), nullable=True),
    sa.Column('effort_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('strategic_fit_score', sa.FLOAT(), nullable=True),
    sa.Column('strategic_fit_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('risk_score', sa.FLOAT(), nullable=True),
    sa.Column('risk_rationale', sa.VARCHAR(), nullable=True),
    sa.Column('composite_score', sa.FLOAT(), nullable=True),
    sa.Column('is_duplicate', sa.Boolean(), nullable=False),
    sa.Column('duplicate_of_id', sa.INTEGER(), nullable=True),
    sa.Column('is_final', sa.Boolean(), nullable=False),
    sa.Column('display_order', sa.INTEGER(), nullable=False),
    sa.Column('created_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['session_id'], ['ideation_sessions.id'], ),
    sa.ForeignKeyConstraint(['cluster_id'], ['idea_clusters.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_generated_ideas_session_id'), 'generated_ideas', ['session_id'], unique=False)
    
    # Create holiday_configs first (no dependencies)
    op.create_table('holiday_configs',
    sa.Column('id', sa.INTEGER(), autoincrement=True, nullable=False),
    sa.Column('name', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('calendar_type', sa.TEXT(), autoincrement=False, nullable=False),
    sa.Column('country_codes', postgresql.JSONB(astext_type=sa.Text()), server_default=sa.text("'[]'::jsonb"), autoincrement=False, nullable=True),
    sa.Column('is_default', sa.Boolean(), server_default=sa.text('0'), autoincrement=False, nullable=False),
    sa.PrimaryKeyConstraint('id', name=op.f('holiday_configs_pkey'))
    )




def downgrade() -> None:
    """Downgrade schema - drop all tables in reverse order."""
    op.drop_index(op.f('gen_extracted_facts_feedback_idx'), table_name='generation_extracted_facts')
    op.drop_index(op.f('gen_extracted_facts_status_idx'), table_name='generation_extracted_facts')
    op.drop_table('generation_extracted_facts')

    op.drop_index(op.f('extracted_facts_feedback_idx'), table_name='extracted_facts')
    op.drop_index(op.f('extracted_facts_status_idx'), table_name='extracted_facts')
    op.drop_table('extracted_facts')

    op.drop_table('messages')
    op.drop_table('conversations')

    op.drop_index(op.f('artifact_jira_links_artifact_idx'), table_name='artifact_jira_links')
    op.drop_index(op.f('artifact_jira_links_integration_idx'), table_name='artifact_jira_links')
    op.drop_table('artifact_jira_links')

    op.drop_index(op.f('required_fields_integration_idx'), table_name='required_fields')
    op.drop_index(op.f('required_fields_project_idx'), table_name='required_fields')
    op.drop_index(op.f('required_fields_unique'), table_name='required_fields')
    op.drop_table('required_fields')

    op.drop_index(op.f('field_mappings_integration_idx'), table_name='field_mappings')
    op.drop_table('field_mappings')

    op.drop_index(op.f('jira_issues_assignee_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_epic_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_integration_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_key_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_project_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_sprint_idx'), table_name='jira_issues')
    op.drop_index(op.f('jira_issues_unique'), table_name='jira_issues')
    op.drop_table('jira_issues')

    op.drop_index(op.f('jira_sprints_board_idx'), table_name='jira_sprints')
    op.drop_index(op.f('jira_sprints_integration_idx'), table_name='jira_sprints')
    op.drop_index(op.f('jira_sprints_state_idx'), table_name='jira_sprints')
    op.drop_index(op.f('jira_sprints_unique'), table_name='jira_sprints')
    op.drop_table('jira_sprints')

    op.drop_index(op.f('jira_boards_integration_idx'), table_name='jira_boards')
    op.drop_index(op.f('jira_boards_unique'), table_name='jira_boards')
    op.drop_table('jira_boards')

    op.drop_index(op.f('custom_holidays_config_idx'), table_name='custom_holidays')
    op.drop_index(op.f('custom_holidays_date_idx'), table_name='custom_holidays')
    op.drop_table('custom_holidays')

    op.drop_index(op.f('pi_planned_items_board_idx'), table_name='pi_planned_items')
    op.drop_index(op.f('pi_planned_items_session_idx'), table_name='pi_planned_items')
    op.drop_index(op.f('pi_planned_items_sprint_idx'), table_name='pi_planned_items')
    op.drop_table('pi_planned_items')

    op.drop_index(op.f('pi_team_capabilities_board_idx'), table_name='pi_team_capabilities')
    op.drop_table('pi_team_capabilities')

    op.drop_index(op.f('pi_versions_created_idx'), table_name='pi_plan_versions')
    op.drop_index(op.f('pi_versions_session_idx'), table_name='pi_plan_versions')
    op.drop_table('pi_plan_versions')

    op.drop_index(op.f('pi_sprints_session_idx'), table_name='pi_sprints')
    op.drop_index(op.f('pi_sprints_unique'), table_name='pi_sprints')
    op.drop_table('pi_sprints')

def downgrade() -> None:
    """Downgrade schema - drop all tables in reverse order."""
    # Ideation
    op.drop_index(op.f('ix_generated_ideas_session_id'), table_name='generated_ideas')
    op.drop_table('generated_ideas')
    op.drop_index(op.f('ix_idea_clusters_session_id'), table_name='idea_clusters')
    op.drop_table('idea_clusters')
    op.drop_index(op.f('ix_ideation_sessions_user_id'), table_name='ideation_sessions')
    op.drop_table('ideation_sessions')

    # PI Planning
    op.drop_table('pi_feature_assignments')
    op.drop_table('pi_features')
    op.drop_table('pi_sprints')
    op.drop_table('pi_session_boards')
    op.drop_table('pi_sessions')
    op.drop_table('holiday_configs')

    # PRD
    op.drop_table('generated_prds')
    op.drop_table('prd_templates')

    # Story Generator
    op.drop_table('generation_feedback')
    op.drop_table('generated_artifacts')
    op.drop_table('story_generator_split_tests')
    op.drop_table('prompt_templates')

    # Feedback & Optimize
    op.drop_table('feedback')
    op.drop_table('agent_executions')
    op.drop_table('split_tests')
    op.drop_table('prompt_versions')

    # Chat
    op.drop_table('code_chat_messages')
    op.drop_table('code_chat_sessions')

    # Library
    op.drop_table('library_integrations')
    op.drop_table('library_pages')
    op.drop_table('library_books')

    # Core
    op.drop_table('document_chunks')
    op.drop_table('documents')
    op.drop_table('knowledge_bases')
    op.drop_table('integrations')
    op.drop_table('flow_executions')
    op.drop_table('flows')
    op.drop_table('agents')
    op.drop_table('users')
