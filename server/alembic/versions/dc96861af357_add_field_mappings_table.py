"""add_field_mappings_table

Revision ID: dc96861af357
Revises: f018793a73c7
Create Date: 2025-12-31 14:17:37.596091

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc96861af357'
down_revision: Union[str, Sequence[str], None] = 'f018793a73c7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'field_mappings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('integration_id', sa.Integer(), nullable=False),
        sa.Column('our_field', sa.String(), nullable=False),
        sa.Column('provider_field_id', sa.String(), nullable=False),
        sa.Column('provider_field_name', sa.String(), nullable=False),
        sa.Column('provider_field_type', sa.String(), nullable=True),
        sa.Column('confidence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('admin_confirmed', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['integration_id'], ['integrations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_field_mappings_integration_id', 'field_mappings', ['integration_id'])
    op.create_index('ix_field_mappings_our_field', 'field_mappings', ['our_field'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index('ix_field_mappings_our_field', 'field_mappings')
    op.drop_index('ix_field_mappings_integration_id', 'field_mappings')
    op.drop_table('field_mappings')
