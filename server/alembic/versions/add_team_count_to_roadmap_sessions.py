"""Add team_count and rename story_artifact_ids to artifact_ids in roadmap_sessions

Revision ID: add_team_count_roadmap
Revises: 32cec55b3b82
Create Date: 2025-01-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_team_count_roadmap'
down_revision: Union[str, None] = '32cec55b3b82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add team_count column with default value of 1
    op.add_column('roadmap_sessions', sa.Column('team_count', sa.Integer(), nullable=False, server_default='1'))

    # Rename story_artifact_ids to artifact_ids
    op.alter_column('roadmap_sessions', 'story_artifact_ids', new_column_name='artifact_ids')


def downgrade() -> None:
    # Rename artifact_ids back to story_artifact_ids
    op.alter_column('roadmap_sessions', 'artifact_ids', new_column_name='story_artifact_ids')

    # Remove team_count column
    op.drop_column('roadmap_sessions', 'team_count')
