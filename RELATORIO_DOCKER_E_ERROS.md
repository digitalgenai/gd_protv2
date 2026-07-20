# Relatório — Dockerização + Auditoria do Sistema

Data: 20/07/2026 · Branch: `v1`

## 1. Docker Desktop

Build feito com sucesso via `docker compose build`. Imagens criadas:

| Imagem | Tamanho | Base |
|---|---|---|
| `galpao-design-backend` | ~167 MB | `python:3.12-slim` + gunicorn |
| `galpao-design-frontend` | ~26.6 MB | build `node:20-alpine` → servido por `nginx:alpine` |

Arquivos criados:
- `Dockerfile` (frontend, multi-stage: build Vite → nginx)
- `backend/Dockerfile` (Flask + gunicorn)
- `nginx.conf` (fallback de rotas do SPA — sem isso, F5 em `/propostas/historico` etc. dá 404)
- `.dockerignore` (raiz) e `backend/.dockerignore`
- `docker-compose.yml` — sobe `backend` (porta **5000**) e `frontend` (porta **8090** — 8080 já estava em uso por outro projeto seu, `certificados_frontend`)

**Testado de ponta a ponta**: subi os dois containers, criei um usuário de teste, fiz login pelo navegador através do frontend containerizado (`localhost:8090`) contra o backend containerizado (`localhost:5000`), naveguei até o Dashboard, e removi o usuário de teste depois. Funcionando.

Para rodar:
```
docker compose up -d --build
docker compose logs -f      # acompanhar
docker compose down         # parar
```
O Postgres **não** é containerizado — os dois serviços continuam falando com o banco real (`DATABASE_URL` do `.env`), igual ao ambiente de dev.

### Bugs que o build em ambiente limpo revelou (e que já corrigi)

Rodar em Docker usa um ambiente Python **limpo**, só com o que está em `requirements.txt` — isso expôs problemas que não aparecem no seu ambiente de dev local (que tem um monte de outras libs já instaladas de outros projetos, mascarando a falta):

1. **`requirements.txt` incompleto** — `backend/utils/openai_client.py` importa `openai` e `backend/utils/crm_client.py` importa `requests`, mas nenhum dos dois estava no `requirements.txt`. Um `pip install -r requirements.txt` limpo (exatamente o que o Docker faz) **quebrava o Flask inteiro na inicialização** (`ModuleNotFoundError`), porque `routes/voz.py` e `routes/propostas.py` importam esses módulos no carregamento do app. Corrigido: adicionei `requests==2.32.3`, `openai==2.24.0` e `gunicorn==23.0.0` (esse último pra servir em produção em vez do `flask run`/dev server).

2. **CORS travado só pro Vite dev (`localhost:5173`)** — `app.py` tinha `CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}}...)` fixo no código. Resultado: login funcionava em `npm run dev`, mas **quebrava silenciosamente** em qualquer outro lugar — inclusive no frontend rodando em Docker (`localhost:8090`). O navegador bloqueia a resposta por falta do header `Access-Control-Allow-Origin`, e o app mostra só "Failed to fetch", sem pista nenhuma do motivo real. Reproduzi o erro, confirmei a causa via curl comparando os headers, e corrigi: agora é `CORS_ALLOWED_ORIGINS` no `.env` (lista separada por vírgula), com default só pro Vite dev pra não quebrar nada que já funciona. Já deixei configurado com as duas origens (`:5173` e `:8090`) no seu `.env`.

3. **`.env.example` bem incompleto** — só tinha `VITE_API_BASE_URL`. Quem fosse clonar o projeto do zero seguindo esse arquivo teria o backend quebrando na hora (`DATABASE_URL` é obrigatório, sem fallback). Completei com todas as variáveis reais usadas em `backend/config.py`, com comentário em cada uma.

---

## 2. Achado crítico de segurança (não corrigido — decisão sua)

**Nenhuma rota de negócio do backend verifica autenticação.** Só `routes/auth.py` usa a sessão; `produtos.py`, `propostas.py`, `usuarios.py`, `dashboard.py`, `catalogo_qualidade.py` e `voz.py` não checam nada. O `RequireAuth` do React só esconde a tela — quem chamar a API direto (curl, Postman, etc.) passa reto, sem estar logado.

Confirmei isso ao vivo, contra o backend rodando:

```
curl http://localhost:5000/usuarios
→ 200 OK, devolve nome/e-mail/perfil de TODOS os usuários, sem login nenhum

curl -X POST http://localhost:5000/usuarios -d '{"nome":"Hacker Teste","email":"...","senha":"1234","perfil":"Administrador"}'
→ 201 CREATED — criei uma conta de Administrador do nada, sem autenticar
```

Removi a conta de teste que criei imediatamente depois de confirmar. Mas isso mostra que **qualquer pessoa com a URL do backend consegue**: listar clientes/propostas/usuários, e **criar sua própria conta de Administrador** — sem senha, sem login, sem nada.

Isso não é específico do Docker — é assim hoje em produção/dev também, sempre foi (o Docker só me fez olhar rota por rota pra montar o relatório). Não mudei nada aqui porque é uma mudança de arquitetura (adicionar verificação de sessão em toda rota protegida + checagem de perfil Administrador nas rotas de gestão), não um ajuste pontual — prefiro confirmar com você antes de mexer em autenticação. Posso implementar isso como próximo passo se quiser.

---

## 3. Outras observações (menor prioridade)

- **`SECRET_KEY`** não está definida no seu `.env` — usa o fallback inseguro hardcoded em `config.py` (`dev-only-insecure-secret...`). Reiniciar o backend derruba todas as sessões logadas, e em produção isso precisa ser um valor forte e secreto.
- **`SESSION_COOKIE_SECURE=False`** hardcoded em `app.py` — já documentado no próprio código como "true obrigatório atrás de https em produção", mas fica aqui o lembrete de trocar antes de qualquer deploy real.
- **`Pillow==10.4.0`** no `requirements.txt` está bem atrás da versão que roda no seu ambiente de dev hoje (12.3.0) — não vi quebra, mas vale atualizar o pin pra não ter dev/prod divergindo sem querer.
- **Sem framework de migration** (nenhum Alembic/SQL versionado) — mudanças de schema (como a coluna `crm_opportunity_id` que adicionei antes) são feitas manualmente, sem histórico. Isso já era assim antes desta sessão, só documentando.

---

## 4. Resumo do que fazer agora

- [x] Imagens Docker criadas e buildando certinho
- [x] Stack completo testado de ponta a ponta (login real através dos dois containers)
- [x] Corrigido: dependências faltando (`openai`, `requests`) que quebravam build limpo
- [x] Corrigido: CORS hardcoded que quebrava qualquer origem fora do Vite dev
- [x] Corrigido: `.env.example` incompleto
- [ ] **Decisão sua**: quer que eu implemente autenticação/autorização real nas rotas do backend? (achado crítico, seção 2)
