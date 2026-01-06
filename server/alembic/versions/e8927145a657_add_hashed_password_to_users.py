"""add_hashed_password_to_users

Revision ID: e8927145a657
Revises: d9ee9129cfd1
Create Date: 2026-01-05 13:40:42.843531

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e8927145a657'
down_revision: Union[str, Sequence[str], None] = 'd9ee9129cfd1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from sqlalchemy import inspect
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = [col['name'] for col in inspector.get_columns('users')]
    if 'hashed_password' not in columns:
        op.add_column('users', sa.Column('hashed_password', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'hashed_password')
