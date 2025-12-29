"""add_released_at_to_generated_artifacts

Revision ID: aa51539b785e
Revises: manual_add_kb_ids
Create Date: 2025-12-29 11:11:13.122634

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'aa51539b785e'
down_revision: Union[str, Sequence[str], None] = 'manual_add_kb_ids'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add released_at and released_in_session_id to generated_artifacts"""
    op.add_column('generated_artifacts', sa.Column('released_at', sa.DateTime(), nullable=True))
    op.add_column('generated_artifacts', sa.Column('released_in_session_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_generated_artifacts_released_in_session',
        'generated_artifacts',
        'release_prep_sessions',
        ['released_in_session_id'],
        ['id']
    )


def downgrade() -> None:
    """Remove released_at and released_in_session_id from generated_artifacts"""
    op.drop_constraint('fk_generated_artifacts_released_in_session', 'generated_artifacts', type_='foreignkey')
    op.drop_column('generated_artifacts', 'released_in_session_id')
    op.drop_column('generated_artifacts', 'released_at')
