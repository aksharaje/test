"""add_input_images_to_test_script_writer

Revision ID: c6a693645008
Revises: 1ebbbd1df9ee
Create Date: 2025-12-31 13:40:36.745847

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c6a693645008'
down_revision: Union[str, Sequence[str], None] = '1ebbbd1df9ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'test_script_writer_sessions',
        sa.Column('input_images', sa.JSON(), nullable=True, server_default='[]')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('test_script_writer_sessions', 'input_images')
