from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session

from config import DATABASE_URL, DB_SCHEMA

# As funções de trigger do banco (fn_generate_codigo_base_proposta e outras) referenciam
# tabelas SEM qualificar o schema (ex.: "INSERT INTO propostas_contador_mensal_vendedor"),
# então dependem do search_path da sessão pra resolver corretamente — sem isso, o Postgres
# procura em "public" e falha (ou pior, acerta em outra tabela homônima). Toda conexão
# precisa abrir já com esse search_path.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={"options": f"-csearch_path={DB_SCHEMA},public"},
)
# expire_on_commit=True (padrão): depois de commit, o próximo acesso a um atributo
# recarrega a linha do banco — necessário porque várias colunas (codigo, codigo_base,
# codigo_proposta, valor_total, atualizado_em/updated_at) são geradas por trigger/
# STORED GENERATED no Postgres, nunca definidas pela aplicação.
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False))


def get_session():
    return SessionLocal()
