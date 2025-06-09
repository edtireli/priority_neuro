"""add paused_awaiting_data status to jobstatus enum

Revision ID: f64c2a89b652
Revises: a1b2c3d4e5f6
Create Date: 2025-06-09 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f64c2a89b652'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("ALTER TYPE jobstatus ADD VALUE IF NOT EXISTS 'paused_awaiting_data'")


def downgrade() -> None:
    """Downgrade schema."""
    # Can't easily remove enum values in Postgres; no-op
    pass
