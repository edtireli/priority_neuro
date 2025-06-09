"""add profile_picture column to users

Revision ID: c1a7b3d47efa
Revises: f64c2a89b652
Create Date: 2025-06-10 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c1a7b3d47efa'
down_revision: Union[str, None] = 'f64c2a89b652'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('profile_picture', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'profile_picture')
