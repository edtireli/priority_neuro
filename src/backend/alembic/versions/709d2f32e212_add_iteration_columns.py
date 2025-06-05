"""add iteration and results folder columns

Revision ID: 709d2f32e212
Revises: 68ab5671e369
Create Date: 2025-06-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '709d2f32e212'
down_revision: Union[str, None] = '68ab5671e369'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('jobs', sa.Column('iteration', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('jobs', sa.Column('maxIterations', sa.Integer(), nullable=True))
    op.add_column('jobs', sa.Column('results_folder', sa.String(), nullable=True))
    op.drop_column('jobs', 'result_location')
    op.alter_column('jobs', 'iteration', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('jobs', sa.Column('result_location', sa.String(), nullable=True))
    op.drop_column('jobs', 'results_folder')
    op.drop_column('jobs', 'maxIterations')
    op.drop_column('jobs', 'iteration')
