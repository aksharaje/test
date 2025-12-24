"""remove_feature_description_length_limit

Revision ID: fb0f60cc444c
Revises: 5ccc1264e0ec
Create Date: 2025-12-24 08:18:14.604279

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fb0f60cc444c'
down_revision: Union[str, Sequence[str], None] = '5ccc1264e0ec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Change feature_description from String(2000) to Text for unlimited length."""
    op.alter_column(
        'feasibility_sessions',
        'feature_description',
        existing_type=sa.String(length=2000),
        type_=sa.Text(),
        existing_nullable=False
    )


def downgrade() -> None:
    """Revert feature_description back to String(2000)."""
    op.alter_column(
        'feasibility_sessions',
        'feature_description',
        existing_type=sa.Text(),
        type_=sa.String(length=2000),
        existing_nullable=False
    )
