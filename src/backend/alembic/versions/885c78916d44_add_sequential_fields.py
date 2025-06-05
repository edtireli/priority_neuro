"""add sequential fields

Revision ID: 885c78916d44
Revises: 68ab5671e369
Create Date: 2025-06-05 00:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '885c78916d44'
down_revision: Union[str, None] = '68ab5671e369'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('jobs', sa.Column('iteration', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('jobs', sa.Column('maxIterations', sa.Integer(), nullable=True))
    op.alter_column('jobs', 'result_location', new_column_name='results_folder')
    op.alter_column('jobs', 'iteration', server_default=None)


def downgrade() -> None:
    op.alter_column('jobs', 'results_folder', new_column_name='result_location')
    op.drop_column('jobs', 'maxIterations')
    op.drop_column('jobs', 'iteration')
