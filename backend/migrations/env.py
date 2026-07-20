import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# backend/ (pai de migrations/) precisa estar no sys.path pra "import config"/"import models"
# funcionarem igual ao resto do app (mesmo padrão de import usado em app.py/db.py).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import DATABASE_URL, DB_SCHEMA  # noqa: E402
from models import Base  # noqa: E402

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# DATABASE_URL vem do .env (via config.py), nunca do alembic.ini — evita duplicar credenciais
# num arquivo versionado no git. "%" escapado porque o ConfigParser por trás do Config do
# Alembic trata "%" como início de interpolação — sem isso, uma senha com "%" (comum em URL-
# encoding de caracteres especiais) quebra com "invalid interpolation syntax".
config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata dos models reais (backend/models.py) — usado pelo autogenerate pra comparar model
# vs. banco. ENUMs com create_type=False e triggers/generated columns não entram nessa
# comparação (não são modelados pelo SQLAlchemy) — revise todo autogenerate a mão antes de
# aplicar, especialmente perto dessas partes do schema.
target_metadata = Base.metadata

# Tabela alembic_version e comparação de tabelas ficam dentro do schema real do projeto
# (galpaodesign_teste em dev), não em "public" — mesmo schema que db.py já usa via search_path.
VERSION_TABLE_SCHEMA = DB_SCHEMA


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table_schema=VERSION_TABLE_SCHEMA,
        include_schemas=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args={"options": f"-csearch_path={DB_SCHEMA},public"},
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=VERSION_TABLE_SCHEMA,
            include_schemas=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
