"""adicionar site e contato aos fornecedores

Revision ID: a1c2d3e4f5b6
Revises: 9b8d7c6a5e4f
Create Date: 2026-07-23 12:15:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from config import DB_SCHEMA

revision: str = "a1c2d3e4f5b6"
down_revision: Union[str, Sequence[str], None] = "9b8d7c6a5e4f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fornecedores", sa.Column("site", sa.Text(), nullable=True), schema=DB_SCHEMA)
    op.add_column("fornecedores", sa.Column("contato", sa.Text(), nullable=True), schema=DB_SCHEMA)


def downgrade() -> None:
    op.drop_column("fornecedores", "contato", schema=DB_SCHEMA)
    op.drop_column("fornecedores", "site", schema=DB_SCHEMA)
