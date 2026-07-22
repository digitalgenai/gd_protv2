"""renomear colunas de preco em produto_customizacoes

Revision ID: 67a0039ea48c
Revises: 4cfe93fab3cf
Create Date: 2026-07-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

from config import DB_SCHEMA

# revision identifiers, used by Alembic.
revision: str = '67a0039ea48c'
down_revision: Union[str, Sequence[str], None] = '4cfe93fab3cf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Renomeia pra terminologia de negócio: preco_b2b (preço de venda ao canal B2B) vira
    preco_venda; preco_b2c (preço final ao consumidor) vira preco_final."""
    op.alter_column("produto_customizacoes", "preco_b2b", new_column_name="preco_venda", schema=DB_SCHEMA)
    op.alter_column("produto_customizacoes", "preco_b2b_txt", new_column_name="preco_venda_txt", schema=DB_SCHEMA)
    op.alter_column("produto_customizacoes", "preco_b2c", new_column_name="preco_final", schema=DB_SCHEMA)


def downgrade() -> None:
    op.alter_column("produto_customizacoes", "preco_venda", new_column_name="preco_b2b", schema=DB_SCHEMA)
    op.alter_column("produto_customizacoes", "preco_venda_txt", new_column_name="preco_b2b_txt", schema=DB_SCHEMA)
    op.alter_column("produto_customizacoes", "preco_final", new_column_name="preco_b2c", schema=DB_SCHEMA)
