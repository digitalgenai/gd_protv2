"""adicionar cadastro de materiais e tecidos

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-07-23 15:45:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from config import DB_SCHEMA

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "materiais_catalogo",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("tipo", sa.Text(), server_default="Tecido", nullable=False),
        sa.Column("nome", sa.Text(), nullable=False),
        sa.Column("referencia", sa.Text(), nullable=True),
        sa.Column("fornecedor_id", sa.Integer(), nullable=False),
        sa.Column("ativo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["fornecedor_id"],
            [f"{DB_SCHEMA}.fornecedores.id"],
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=DB_SCHEMA,
    )
    op.create_index(
        "ix_materiais_catalogo_fornecedor",
        "materiais_catalogo",
        ["fornecedor_id"],
        unique=False,
        schema=DB_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("ix_materiais_catalogo_fornecedor", table_name="materiais_catalogo", schema=DB_SCHEMA)
    op.drop_table("materiais_catalogo", schema=DB_SCHEMA)
