"""adicionar configuracoes do sistema

Revision ID: b2c3d4e5f6a7
Revises: a1c2d3e4f5b6
Create Date: 2026-07-23 15:20:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from config import DB_SCHEMA

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1c2d3e4f5b6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FLAG_KEY = "vendedores_cadastram_produtos"


def upgrade() -> None:
    op.create_table(
        "configuracoes_sistema",
        sa.Column("chave", sa.Text(), nullable=False),
        sa.Column("valor", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("chave"),
        schema=DB_SCHEMA,
    )
    tabela = sa.table(
        "configuracoes_sistema",
        sa.column("chave", sa.Text()),
        sa.column("valor", postgresql.JSONB()),
        sa.column("descricao", sa.Text()),
        schema=DB_SCHEMA,
    )
    op.bulk_insert(tabela, [{
        "chave": FLAG_KEY,
        "valor": True,
        "descricao": "Permite que vendedores cadastrem e editem produtos durante a força-tarefa do catálogo.",
    }])


def downgrade() -> None:
    op.drop_table("configuracoes_sistema", schema=DB_SCHEMA)
