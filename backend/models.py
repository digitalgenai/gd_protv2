from sqlalchemy import (
    Boolean, Column, FetchedValue, ForeignKey, Integer, BigInteger, Numeric, SmallInteger,
    Text, DateTime,
)
from sqlalchemy.dialects.postgresql import UUID, ENUM, JSONB
from sqlalchemy.orm import declarative_base, relationship

from config import DB_SCHEMA

Base = declarative_base()

status_versao_enum = ENUM(
    "rascunho", "enviada", "aprovada", "recusada",
    name="status_versao_enum", schema=DB_SCHEMA, create_type=False,
)

status_arquivo_enum = ENUM(
    "ok", "processando", "erro",
    name="status_arquivo_enum", schema=DB_SCHEMA, create_type=False,
)

status_rascunho_enum = ENUM(
    "aguardando_revisao", "confirmado", "descartado",
    name="status_rascunho_enum", schema=DB_SCHEMA, create_type=False,
)

status_item_rascunho_enum = ENUM(
    "encontrado", "nao_encontrado",
    name="status_item_rascunho_enum", schema=DB_SCHEMA, create_type=False,
)

# server_default=FetchedValue() marca colunas com DEFAULT/trigger no próprio Postgres
# (now(), triggers de código, GENERATED STORED) — sem isso o SQLAlchemy manda um NULL
# explícito no INSERT e ISSO SOBRESCREVE o default do banco (NOT NULL violation) ou,
# no caso de coluna GENERATED, o Postgres rejeita a instrução inteira. Nunca setar
# essas colunas manualmente no código da app; usar session.refresh(obj) para ler o
# valor gerado depois do commit.


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=FetchedValue())
    nome = Column(Text, nullable=False)
    email = Column(Text, nullable=False)
    senha_hash = Column(Text, nullable=False)
    perfil = Column(Text, nullable=False, default="Vendedor")
    setor = Column(Text, nullable=False, default="Vendas")
    codigo_vendedor = Column(Integer, server_default=FetchedValue())  # trigger usuarios_auto_codigo_vendedor
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=FetchedValue())
    updated_at = Column(DateTime(timezone=True), server_default=FetchedValue())


class Fornecedor(Base):
    __tablename__ = "fornecedores"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    nome = Column(Text, nullable=False)
    pasta_id = Column(Text)
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    markup = Column(Numeric(5, 4))


class CatalogoProduto(Base):
    __tablename__ = "catalogo_produtos"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(BigInteger, primary_key=True)
    fornecedor_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.fornecedores.id"))
    arquivo_id = Column(Integer)
    categoria = Column(Text)
    produto_nome = Column(Text)
    codigo = Column(Text, server_default=FetchedValue())  # trigger fn_gen_codigo_produto
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    atualizado_em = Column(DateTime(timezone=True), server_default=FetchedValue())  # trigger fn_set_atualizado_em

    fornecedor = relationship("Fornecedor")
    customizacoes = relationship("ProdutoCustomizacao", back_populates="produto")
    imagens = relationship("ProdutoImagem", back_populates="produto", order_by="ProdutoImagem.posicao")


class ProdutoCustomizacao(Base):
    __tablename__ = "produto_customizacoes"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(BigInteger, primary_key=True)
    produto_id = Column(BigInteger, ForeignKey(f"{DB_SCHEMA}.catalogo_produtos.id"), nullable=False)
    acabamento = Column(Text)
    material = Column(Text)
    dimensoes = Column(Text)
    unidade = Column(Text)
    preco_b2b = Column(Numeric(12, 2))
    preco_b2b_txt = Column(Text)
    preco_b2c = Column(Numeric(12, 2))
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    atualizado_em = Column(DateTime(timezone=True), server_default=FetchedValue())

    produto = relationship("CatalogoProduto", back_populates="customizacoes")


class ProdutoImagem(Base):
    __tablename__ = "produtos_imagens"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    produto_id = Column(BigInteger, ForeignKey(f"{DB_SCHEMA}.catalogo_produtos.id"), nullable=False)
    storage_path = Column(Text, nullable=False)
    filename = Column(Text, nullable=False)
    posicao = Column(SmallInteger, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())

    produto = relationship("CatalogoProduto", back_populates="imagens")


class Proposta(Base):
    __tablename__ = "propostas"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    vendedor_id = Column(UUID(as_uuid=True), ForeignKey(f"{DB_SCHEMA}.usuarios.id"))
    codigo_base = Column(Text, server_default=FetchedValue())  # trigger fn_generate_codigo_base_proposta
    cliente_nome = Column(Text, nullable=False)
    cliente_telefone = Column(Text)
    cliente_endereco = Column(Text)
    cliente_email = Column(Text)  # coluna a ser adicionada em produção pela equipe de dados
    arquiteto_nome = Column(Text)
    observacoes = Column(Text)
    desconto_geral = Column(Numeric(5, 2), nullable=False, default=0)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    updated_at = Column(DateTime(timezone=True), server_default=FetchedValue())

    vendedor = relationship("Usuario")
    versoes = relationship("PropostaVersao", back_populates="proposta", order_by="PropostaVersao.versao_numero")


class PropostaVersao(Base):
    __tablename__ = "propostas_versoes"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    proposta_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.propostas.id"), nullable=False)
    versao_numero = Column(SmallInteger, nullable=False, default=1)
    codigo_proposta = Column(Text, server_default=FetchedValue())  # trigger fn_generate_codigo_versao_proposta
    status = Column(status_versao_enum, nullable=False, default="rascunho")
    pdf_path = Column(Text)
    xlsx_path = Column(Text)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    updated_at = Column(DateTime(timezone=True), server_default=FetchedValue())

    proposta = relationship("Proposta", back_populates="versoes")
    itens = relationship("PropostaItem", back_populates="versao")


class PropostaItem(Base):
    __tablename__ = "propostas_itens"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    versao_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.propostas_versoes.id"), nullable=False)
    produto_id = Column(BigInteger, ForeignKey(f"{DB_SCHEMA}.catalogo_produtos.id"))
    codigo_produto = Column(Text, nullable=False)
    nome_produto = Column(Text, nullable=False)
    preco_unitario_snapshot = Column(Numeric(12, 2), nullable=False)
    quantidade = Column(Integer, nullable=False, default=1)
    desconto_percentual = Column(Numeric(5, 2), nullable=False, default=0)
    valor_total = Column(Numeric(14, 2), server_default=FetchedValue())  # STORED GENERATED — nunca setar
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    customizacao_id = Column(BigInteger, ForeignKey(f"{DB_SCHEMA}.produto_customizacoes.id"))
    customizacao_descricao = Column(Text)
    customizacao_snapshot = Column(Text)

    versao = relationship("PropostaVersao", back_populates="itens")


class ArquivoDrive(Base):
    __tablename__ = "arquivos_drive"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    file_id = Column(Text, nullable=False)
    fornecedor_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.fornecedores.id"))
    nome = Column(Text)
    mime_type = Column(Text)
    checksum = Column(Text)
    status = Column(status_arquivo_enum, nullable=False, default="ok")
    processado_em = Column(DateTime(timezone=True), server_default=FetchedValue())

    fornecedor = relationship("Fornecedor")


class ErroImportacao(Base):
    __tablename__ = "erros_importacao"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    arquivo_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.arquivos_drive.id"))
    aba = Column(Text)
    linha = Column(Integer)
    mensagem = Column(Text, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())

    arquivo = relationship("ArquivoDrive")


class PropostaRascunho(Base):
    __tablename__ = "proposta_rascunhos"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    transcricao_original = Column(Text, nullable=False)
    dados_extraidos = Column(JSONB)
    status = Column(status_rascunho_enum, nullable=False, default="aguardando_revisao")
    vendedor_id = Column(UUID(as_uuid=True), ForeignKey(f"{DB_SCHEMA}.usuarios.id"))
    arquiteto = Column(Text)
    cliente_nome = Column(Text)
    criado_em = Column(DateTime(timezone=True), server_default=FetchedValue())
    expira_em = Column(DateTime(timezone=True), server_default=FetchedValue())

    vendedor = relationship("Usuario")
    itens = relationship("RascunhoItem", back_populates="rascunho")


class RascunhoItem(Base):
    __tablename__ = "rascunho_itens"
    __table_args__ = {"schema": DB_SCHEMA}

    id = Column(Integer, primary_key=True)
    rascunho_id = Column(Integer, ForeignKey(f"{DB_SCHEMA}.proposta_rascunhos.id"), nullable=False)
    codigo_extraido = Column(Text, nullable=False)
    produto_id = Column(BigInteger, ForeignKey(f"{DB_SCHEMA}.catalogo_produtos.id"))
    quantidade = Column(Numeric, nullable=False, default=1)
    desconto = Column(Numeric, nullable=False, default=0)
    status = Column(status_item_rascunho_enum, nullable=False, default="encontrado")

    rascunho = relationship("PropostaRascunho", back_populates="itens")
    produto = relationship("CatalogoProduto")
