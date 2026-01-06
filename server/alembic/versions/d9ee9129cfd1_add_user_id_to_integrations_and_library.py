"""add_user_id_to_integrations_and_library

Revision ID: d9ee9129cfd1
Revises: a8880d488541
Create Date: 2026-01-05 11:10:30.598613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd9ee9129cfd1'
down_revision: Union[str, Sequence[str], None] = 'a8880d488541'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)

    # Add user_id to integrations table
    int_cols = [col['name'] for col in inspector.get_columns('integrations')]
    if 'user_id' not in int_cols:
        op.add_column('integrations', sa.Column('user_id', sa.Integer(), nullable=True))
        try:
            op.create_foreign_key('fk_integrations_user_id', 'integrations', 'users', ['user_id'], ['id'])
        except Exception:
            pass

    # Add user_id to library_books table
    lib_cols = [col['name'] for col in inspector.get_columns('library_books')]
    if 'user_id' not in lib_cols:
        op.add_column('library_books', sa.Column('user_id', sa.Integer(), nullable=True))
        try:
            op.create_foreign_key('fk_library_books_user_id', 'library_books', 'users', ['user_id'], ['id'])
        except Exception:
            pass


def downgrade() -> None:
    """Downgrade schema."""
    # Remove from library_books
    op.drop_constraint('fk_library_books_user_id', 'library_books', type_='foreignkey')
    op.drop_column('library_books', 'user_id')

    # Remove from integrations
    op.drop_constraint('fk_integrations_user_id', 'integrations', type_='foreignkey')
    op.drop_column('integrations', 'user_id')
