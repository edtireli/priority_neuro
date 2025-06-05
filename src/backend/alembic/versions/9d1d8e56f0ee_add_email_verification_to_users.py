from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '9d1d8e56f0ee'
down_revision: Union[str, None] = '709d2f32e212'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('users', sa.Column('verification_token', sa.String(), nullable=True))
    op.add_column('users', sa.Column('verification_sent_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'verification_sent_at')
    op.drop_column('users', 'verification_token')
    op.drop_column('users', 'is_verified')
