"""add information_gain and se columns to job_metrics

Revision ID: d1c2a3b4e5f6
Revises: 871b047fd9a5
Create Date: 2025-06-10 00:00:00.000000
"""

from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "d1c2a3b4e5f6"
down_revision: Union[str, Sequence[str], None] = "871b047fd9a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "job_metrics", sa.Column("information_gain", sa.Float(), nullable=True)
    )
    op.add_column("job_metrics", sa.Column("se", sa.Float(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("job_metrics", "se")
    op.drop_column("job_metrics", "information_gain")
