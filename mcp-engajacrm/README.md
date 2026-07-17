# mcp-engajacrm

MCP server que conecta o Claude Code ao **EngajaCRM** (fork do EspoCRM usado pela Digital College /
Engaja Comunicação — branch `galpao-stable` no [github.com/digitalcollegebr/engajacrm](https://github.com/digitalcollegebr/engajacrm)).

Como o EngajaCRM é um EspoCRM padrão por baixo (só com tema/branding próprios), este servidor fala
diretamente com a [API REST do EspoCRM](https://docs.espocrm.com/development/api/) — não depende de
nenhuma customização específica do branch.

## Ferramentas expostas

- `list_records` — busca/lista registros de qualquer entidade (Contact, Lead, Account, Opportunity, Task, Meeting, Call, User, Document, Note, ...), com filtro de texto livre, filtros estruturados (`where`), paginação e ordenação.
- `get_record` — busca um registro específico pelo id.
- `create_record` — cria um registro novo.
- `update_record` — atualiza campos de um registro existente.
- `delete_record` — move um registro pra lixeira (soft-delete do EspoCRM — recuperável pela Administração, não é exclusão definitiva).

## Configuração

1. **Gerar a API Key no EspoCRM**: entre no EngajaCRM com um usuário administrador → **Administração
   → Usuários de API → Novo** → tipo de autenticação **API Key**. Dê a esse usuário só as permissões
   que a integração realmente precisa (ex.: acesso de leitura/escrita a Contact/Lead/Opportunity).
2. Copie `.env.example` para `.env` dentro desta pasta (`mcp-engajacrm/.env`) e preencha:
   ```
   ESPOCRM_BASE_URL=https://sua-instancia.engajacrm.com.br
   ESPOCRM_API_KEY=xxxxxxxxxxxxxxxx
   ```
3. Instale as dependências:
   ```
   cd mcp-engajacrm
   npm install
   ```

O servidor já está registrado em `.mcp.json` na raiz do projeto — o Claude Code carrega automaticamente
quando você abre a pasta `Galpão Designer` (pode ser preciso aprovar o novo servidor MCP na primeira vez).

## Rodando manualmente (fora do Claude Code)

```
npm run dev     # via tsx, direto do TypeScript
# ou
npm run build && npm start   # compilado
```

## Notas de segurança

- A API Key fica só em `mcp-engajacrm/.env` (gitignorado) — nunca commitar esse arquivo nem colocar a
  chave em `.mcp.json`.
- `create_record` / `update_record` / `delete_record` gravam/alteram dados reais no CRM da empresa —
  revise o que está sendo enviado antes de confirmar essas ações numa sessão do Claude.
