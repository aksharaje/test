"""rename_release_prep_session_fields

Revision ID: 54c7269b082e
Revises: b966caa78986
Create Date: 2025-12-29 10:23:30.979880

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '54c7269b082e'
down_revision: Union[str, Sequence[str], None] = 'b966caa78986'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename session_name to release_name and drop unused columns."""
    # Rename session_name to release_name
    op.alter_column('release_prep_sessions', 'session_name',
                    new_column_name='release_name')

    # Drop release_version and release_date columns
    op.drop_column('release_prep_sessions', 'release_version')
    op.drop_column('release_prep_sessions', 'release_date')


def downgrade() -> None:
    """Restore original column names."""
    # Add back release_version and release_date columns
    op.add_column('release_prep_sessions',
                  sa.Column('release_version', sa.VARCHAR(), nullable=True))
    op.add_column('release_prep_sessions',
                  sa.Column('release_date', sa.TIMESTAMP(), nullable=True))

    # Rename release_name back to session_name
    op.alter_column('release_prep_sessions', 'release_name',
                    new_column_name='session_name')
