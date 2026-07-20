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
    pool_pre_ping=True,   # descarta conexão morta (banco reiniciou, rede caiu) antes de usar
    pool_recycle=1800,    # recicla conexão a cada 30min — evita conexão "velha" derrubada pelo servidor
    pool_timeout=10,      # se o pool esgotar, falha em 10s em vez de pendurar a request pra sempre
    connect_args={
        # search_path: triggers do banco referenciam tabelas sem qualificar o schema (ver acima).
        # idle_in_transaction_session_timeout: mata do lado do Postgres qualquer transação deixada
        #   aberta ociosa por >60s — rede de segurança caso alguma sessão escape do teardown do
        #   app (foi o que travou a produção: transações "idle in transaction" penduradas seguravam
        #   os workers e derrubavam tudo com Gateway Timeout).
        # statement_timeout: aborta query que passe de 30s (nenhuma query legítima da app chega
        #   perto disso) em vez de segurar um worker indefinidamente.
        "options": (
            f"-csearch_path={DB_SCHEMA},public"
            " -cidle_in_transaction_session_timeout=60000"
            " -cstatement_timeout=30000"
        ),
    },
)
# expire_on_commit=True (padrão): depois de commit, o próximo acesso a um atributo
# recarrega a linha do banco — necessário porque várias colunas (codigo, codigo_base,
# codigo_proposta, valor_total, atualizado_em/updated_at) são geradas por trigger/
# STORED GENERATED no Postgres, nunca definidas pela aplicação.
SessionLocal = scoped_session(sessionmaker(bind=engine, autoflush=False))


def get_session():
    return SessionLocal()
