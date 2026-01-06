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
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('release_prep_sessions')]

    # Rename session_name to release_name (only if session_name exists and release_name doesn't)
    if 'session_name' in columns and 'release_name' not in columns:
        op.alter_column('release_prep_sessions', 'session_name',
                        new_column_name='release_name')

    # Drop release_version and release_date columns if they exist
    if 'release_version' in columns:
        op.drop_column('release_prep_sessions', 'release_version')
    if 'release_date' in columns:
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
