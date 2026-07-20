"""mover crm_opportunity_id de propostas_versoes para propostas

Revision ID: 4cfe93fab3cf
Revises: e3dc48254397
Create Date: 2026-07-20 08:54:34.525572

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

from config import DB_SCHEMA

# revision identifiers, used by Alembic.
revision: str = '4cfe93fab3cf'
down_revision: Union[str, Sequence[str], None] = 'e3dc48254397'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Uma Opportunity por proposta, não por versão — evita duplicar card no kanban a cada
    nova versão salva (ver routes/propostas.py)."""
    op.add_column("propostas", sa.Column("crm_opportunity_id", sa.Text(), nullable=True), schema=DB_SCHEMA)

    # Backfill: se alguma versão já tinha um crm_opportunity_id, herda pra proposta (usa o da
    # versão mais recente que tiver um, caso hajam múltiplos — não deveria haver, mas defensivo).
    op.execute(f"""
        UPDATE {DB_SCHEMA}.propostas p
        SET crm_opportunity_id = sub.crm_opportunity_id
        FROM (
            SELECT DISTINCT ON (proposta_id) proposta_id, crm_opportunity_id
            FROM {DB_SCHEMA}.propostas_versoes
            WHERE crm_opportunity_id IS NOT NULL
            ORDER BY proposta_id, versao_numero DESC
        ) sub
        WHERE p.id = sub.proposta_id
    """)

    op.drop_column("propostas_versoes", "crm_opportunity_id", schema=DB_SCHEMA)


def downgrade() -> None:
    op.add_column("propostas_versoes", sa.Column("crm_opportunity_id", sa.Text(), nullable=True), schema=DB_SCHEMA)
    op.execute(f"""
        UPDATE {DB_SCHEMA}.propostas_versoes v
        SET crm_opportunity_id = p.crm_opportunity_id
        FROM {DB_SCHEMA}.propostas p
        WHERE v.proposta_id = p.id AND v.versao_numero = (
            SELECT MAX(versao_numero) FROM {DB_SCHEMA}.propostas_versoes WHERE proposta_id = p.id
        )
    """)
    op.drop_column("propostas", "crm_opportunity_id", schema=DB_SCHEMA)
