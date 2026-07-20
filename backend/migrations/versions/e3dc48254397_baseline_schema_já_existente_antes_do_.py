"""baseline (schema já existente antes do alembic)

Revision ID: e3dc48254397
Revises: 
Create Date: 2026-07-20 08:42:12.553186

"""
from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = 'e3dc48254397'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Vazia de propósito — marca o ponto em que o schema (já existente, criado via DDL manual
    ao longo do projeto: tabelas, triggers, ENUMs, colunas geradas) passou a ser rastreado por
    Alembic. Bancos já existentes usam `alembic stamp e3dc48254397` (sem rodar upgrade nenhum);
    só um banco novo, do zero, executaria isso — e mesmo assim não criaria nada, porque o
    schema real não é gerenciado por aqui ainda. Daqui pra frente, toda mudança de schema vira
    uma revision nova (ver migrations/README ou o guia no repo)."""


def downgrade() -> None:
    pass
