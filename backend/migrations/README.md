# Migrations (Alembic)

O schema já existia antes do Alembic entrar no projeto (criado via DDL manual — triggers,
ENUMs, colunas geradas). A revision `e3dc48254397` ("baseline") é vazia de propósito: só marca
o ponto em que passamos a rastrear mudanças por aqui. Bancos que já têm esse schema (dev, e
qualquer cópia dele) usam `stamp`, nunca `upgrade`, pra chegar nela.

## Setup num banco que já existe (dev, cópia de produção, etc.)

```
cd backend
python -m alembic stamp head
```

Isso só grava a revision atual na tabela `alembic_version` (schema `DB_SCHEMA`, ex.:
`galpaodesign_teste`) — não roda nenhuma DDL.

## Criando uma migration nova

```
python -m alembic revision --autogenerate -m "descrição curta"
```

**Revise o arquivo gerado à mão antes de aplicar.** O autogenerate compara `models.py` contra
o banco inteiro (todos os schemas) e vai aparecer muita coisa que **não é pra entrar na
migration**:

- Tabelas antigas do protótipo que ainda existem em `public` (ex.: `produtos_unificado`,
  `documentos`, `scheduler_control`, `arquivos_processados` etc.) — não são modeladas em
  `models.py` de propósito, aparecem como "removed table" mas não devem ser apagadas por uma
  migration daqui.
- Diffs cosméticos de FK/index por causa da qualificação de schema (`galpaodesign_teste.` vs
  sem schema) — ruído, não precisa de `op.drop_constraint`/`op.create_foreign_key` pra isso.
- **`usuarios.perfil`**: o banco usa um ENUM real (`perfil_usuario_enum`), mas o model declara
  como `Text` — o autogenerate propõe converter o tipo da coluna. **Não aplique isso** (quebra
  a constraint do enum); é uma lacuna de modelagem, não uma mudança de schema real pendente.
- **`usuarios.email`**: banco usa `CITEXT`, model declara `Text` — mesmo caso, ignorar.

Só inclua na migration final as mudanças que você realmente pretendeu fazer.

## Aplicando

```
python -m alembic upgrade head
```

## Rodando fora do dev local (Docker/Coolify)

`env.py` já lê `DATABASE_URL`/`DB_SCHEMA` do mesmo `.env`/variáveis de ambiente que o Flask usa
(via `config.py`) — não precisa configurar nada separado no `alembic.ini`.
