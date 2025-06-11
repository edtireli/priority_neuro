"""add current_posterior column to projects

Revision ID: abc123efghij
Revises: f64c2a89b652
Create Date: 2025-06-11 00:00:00.000000
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "abc123efghij"
down_revision: Union[str, None] = "f64c2a89b652"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.add_column(
            "projects",
            sa.Column("current_posterior", postgresql.JSONB(), nullable=True),
        )
    else:
        op.add_column(
            "projects", sa.Column("current_posterior", sa.JSON(), nullable=True)
        )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("projects", "current_posterior")
