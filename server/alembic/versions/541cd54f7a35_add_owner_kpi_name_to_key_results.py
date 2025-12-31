"""add_owner_kpi_name_to_key_results

Revision ID: 541cd54f7a35
Revises: add_kpi_assignment
Create Date: 2025-12-30 18:48:20.428632

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '541cd54f7a35'
down_revision: Union[str, Sequence[str], None] = 'add_kpi_assignment'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add owner and kpi_name columns to okr_key_results table
    op.add_column('okr_key_results', sa.Column('owner', sa.String(), nullable=True))
    op.add_column('okr_key_results', sa.Column('kpi_name', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('okr_key_results', 'kpi_name')
    op.drop_column('okr_key_results', 'owner')
