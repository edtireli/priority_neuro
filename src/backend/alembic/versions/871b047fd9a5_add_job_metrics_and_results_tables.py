"""add job_metrics and job_results tables

Revision ID: 871b047fd9a5
Revises: f64c2a89b652, 9d1d8e56f0ee
Create Date: 2025-06-09 12:40:16.537885
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '871b047fd9a5'
# merge heads from previous branches
down_revision: Union[str, Sequence[str], None] = ('f64c2a89b652', '9d1d8e56f0ee')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'job_metrics',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('job_id', sa.UUID(as_uuid=True), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('iteration', sa.Integer(), nullable=False),
        sa.Column('design_point', sa.JSON(), nullable=False),
        sa.Column('utility', sa.Float(), nullable=False),
        sa.Column('posterior_summary', sa.JSON(), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)')),
    )
    op.create_table(
        'job_results',
        sa.Column('id', sa.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column('job_id', sa.UUID(as_uuid=True), sa.ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('summary', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)')),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('job_results')
    op.drop_table('job_metrics')
