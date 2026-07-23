"""corrigir geração sequencial do código de vendedor

Revision ID: 9b8d7c6a5e4f
Revises: 67a0039ea48c
Create Date: 2026-07-23 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op

from config import DB_SCHEMA

# revision identifiers, used by Alembic.
revision: str = "9b8d7c6a5e4f"
down_revision: Union[str, Sequence[str], None] = "67a0039ea48c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Mantém códigos 1, 2, 3... sem saltos causados por nextval em inserts revertidos.

    A trava transacional serializa apenas a escolha do próximo código, evitando que dois
    cadastros simultâneos calculem o mesmo MAX + 1.
    """
    # Normaliza os registros atuais pela ordem em que os usuários foram criados. A etapa
    # negativa evita colisões temporárias caso exista uma restrição UNIQUE não-deferrable.
    op.execute(f"""
        WITH ordenados AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at NULLS LAST, id)::int AS novo_codigo
            FROM {DB_SCHEMA}.usuarios
        )
        UPDATE {DB_SCHEMA}.usuarios u
        SET codigo_vendedor = -o.novo_codigo
        FROM ordenados o
        WHERE u.id = o.id
    """)
    op.execute(f"""
        UPDATE {DB_SCHEMA}.usuarios
        SET codigo_vendedor = -codigo_vendedor
        WHERE codigo_vendedor < 0
    """)

    op.execute(f"""
        CREATE OR REPLACE FUNCTION {DB_SCHEMA}.usuarios_auto_codigo_vendedor()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        BEGIN
            IF NEW.codigo_vendedor IS NULL THEN
                PERFORM pg_advisory_xact_lock(
                    hashtext('{DB_SCHEMA}.usuarios.codigo_vendedor')
                );

                SELECT COALESCE(MAX(u.codigo_vendedor), 0) + 1
                INTO NEW.codigo_vendedor
                FROM {DB_SCHEMA}.usuarios u
                WHERE TG_OP = 'INSERT' OR u.id <> NEW.id;
            END IF;
            RETURN NEW;
        END;
        $function$
    """)

    # Mantém a sequência antiga alinhada caso seja necessário fazer downgrade.
    op.execute(f"""
        SELECT setval(
            '{DB_SCHEMA}.seq_codigo_vendedor',
            GREATEST((SELECT COALESCE(MAX(codigo_vendedor), 1) FROM {DB_SCHEMA}.usuarios), 1),
            true
        )
    """)


def downgrade() -> None:
    op.execute(f"""
        CREATE OR REPLACE FUNCTION {DB_SCHEMA}.usuarios_auto_codigo_vendedor()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $function$
        BEGIN
            IF NEW.codigo_vendedor IS NULL THEN
                LOOP
                    NEW.codigo_vendedor := nextval('{DB_SCHEMA}.seq_codigo_vendedor')::int;
                    EXIT WHEN NOT EXISTS (
                        SELECT 1
                        FROM {DB_SCHEMA}.usuarios u
                        WHERE u.codigo_vendedor = NEW.codigo_vendedor
                          AND (TG_OP = 'INSERT' OR u.id <> NEW.id)
                    );
                END LOOP;
            END IF;
            RETURN NEW;
        END;
        $function$
    """)

