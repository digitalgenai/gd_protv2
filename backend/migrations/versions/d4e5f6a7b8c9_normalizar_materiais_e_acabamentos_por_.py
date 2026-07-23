"""normalizar materiais e acabamentos por fornecedor (migration 008 da analista de dados)

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-07-23 18:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from config import DB_SCHEMA

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABELAS = ("materiais", "acabamentos")


def upgrade() -> None:
    """Essa DDL já existe no banco de dev — aplicada direto pela analista de dados (fora do
    nosso Alembic), documentada no DATABASE.md dela como "migration 008". Esta migration só
    a reproduz aqui pra ficar rastreável e reprodutível em ambientes novos (ex.: produção no
    Coolify); o dev fica só "stamped" nela via `alembic stamp head`, sem rodar de novo."""
    for tabela in TABELAS:
        op.create_table(
            tabela,
            sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
            sa.Column("fornecedor_id", sa.Integer(), nullable=False),
            sa.Column("nome", sa.Text(), nullable=False),
            sa.Column("categoria", sa.Text(), nullable=False),
            sa.Column("classificacao", sa.Text(), nullable=True),
            sa.Column("ativo", sa.Boolean(), server_default=sa.text("true"), nullable=False),
            sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("atualizado_em", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["fornecedor_id"], [f"{DB_SCHEMA}.fornecedores.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint(
                "nome", "categoria", "fornecedor_id",
                name=f"ux_{tabela}_nome_categoria_fornecedor",
            ),
            schema=DB_SCHEMA,
        )
        op.create_index(f"idx_{tabela}_fornecedor", tabela, ["fornecedor_id"], schema=DB_SCHEMA)
        op.create_index(f"idx_{tabela}_categoria", tabela, ["categoria"], schema=DB_SCHEMA)
        op.create_index(
            f"idx_{tabela}_ativos", tabela, ["fornecedor_id", "id"],
            postgresql_where=sa.text("ativo = true"), schema=DB_SCHEMA,
        )
        op.create_index(
            f"idx_{tabela}_nome_trgm", tabela, ["nome"],
            postgresql_using="gin", postgresql_ops={"nome": "gin_trgm_ops"}, schema=DB_SCHEMA,
        )
        op.execute(f"""
            CREATE TRIGGER trg_{tabela}_atualizado_em
            BEFORE UPDATE ON {DB_SCHEMA}.{tabela}
            FOR EACH ROW EXECUTE FUNCTION {DB_SCHEMA}.fn_set_atualizado_em()
        """)

    op.add_column("produto_customizacoes", sa.Column("material_id", sa.BigInteger(), nullable=True), schema=DB_SCHEMA)
    op.add_column("produto_customizacoes", sa.Column("acabamento_id", sa.BigInteger(), nullable=True), schema=DB_SCHEMA)
    op.create_foreign_key(
        "produto_customizacoes_material_id_fkey", "produto_customizacoes", "materiais",
        ["material_id"], ["id"], source_schema=DB_SCHEMA, referent_schema=DB_SCHEMA, ondelete="SET NULL",
    )
    op.create_foreign_key(
        "produto_customizacoes_acabamento_id_fkey", "produto_customizacoes", "acabamentos",
        ["acabamento_id"], ["id"], source_schema=DB_SCHEMA, referent_schema=DB_SCHEMA, ondelete="SET NULL",
    )
    op.create_index(
        "idx_customizacoes_material_id", "produto_customizacoes", ["material_id"],
        postgresql_where=sa.text("material_id IS NOT NULL"), schema=DB_SCHEMA,
    )
    op.create_index(
        "idx_customizacoes_acabamento_id", "produto_customizacoes", ["acabamento_id"],
        postgresql_where=sa.text("acabamento_id IS NOT NULL"), schema=DB_SCHEMA,
    )


def downgrade() -> None:
    op.drop_index("idx_customizacoes_acabamento_id", table_name="produto_customizacoes", schema=DB_SCHEMA)
    op.drop_index("idx_customizacoes_material_id", table_name="produto_customizacoes", schema=DB_SCHEMA)
    op.drop_constraint("produto_customizacoes_acabamento_id_fkey", "produto_customizacoes", schema=DB_SCHEMA, type_="foreignkey")
    op.drop_constraint("produto_customizacoes_material_id_fkey", "produto_customizacoes", schema=DB_SCHEMA, type_="foreignkey")
    op.drop_column("produto_customizacoes", "acabamento_id", schema=DB_SCHEMA)
    op.drop_column("produto_customizacoes", "material_id", schema=DB_SCHEMA)

    for tabela in reversed(TABELAS):
        op.execute(f"DROP TRIGGER IF EXISTS trg_{tabela}_atualizado_em ON {DB_SCHEMA}.{tabela}")
        op.drop_index(f"idx_{tabela}_nome_trgm", table_name=tabela, schema=DB_SCHEMA)
        op.drop_index(f"idx_{tabela}_ativos", table_name=tabela, schema=DB_SCHEMA)
        op.drop_index(f"idx_{tabela}_categoria", table_name=tabela, schema=DB_SCHEMA)
        op.drop_index(f"idx_{tabela}_fornecedor", table_name=tabela, schema=DB_SCHEMA)
        op.drop_table(tabela, schema=DB_SCHEMA)
