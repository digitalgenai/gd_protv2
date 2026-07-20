# Deploy no Coolify — propostagd.digitalgenai.com.br

- **Frontend** → `propostagd.digitalgenai.com.br`
- **Backend (API)** → `api.propostagd.digitalgenai.com.br`

Confirmado com você: o Postgres em `192.168.23.130` continua acessível a partir de onde o
Coolify roda (mesma rede/VPN) — nenhuma mudança de `DATABASE_URL` necessária.

> **Nota (achado no deploy real):** ao apontar o Coolify pro repositório, ele detectou o
> `docker-compose.yml` da raiz sozinho e criou **um único recurso "Docker Compose"** com os
> dois serviços (`backend`/`frontend`), em vez de dois apps separados do tipo "Dockerfile"
> como a seção 1/2 abaixo descreve. As duas abordagens funcionam — se o Coolify já escolheu o
> modo Compose pra você, siga a seção **"Modo Docker Compose (o que realmente aconteceu)"**
> mais abaixo, que tem um gotcha de porta que já pegou a gente uma vez.

---

## 1. App do Backend

**New Resource → Application → Dockerfile** (ou "Docker Build" apontando pro git remote)

| Campo | Valor |
|---|---|
| Repositório | este repo, branch `v1` (ou `main` depois do merge) |
| Base Directory | `backend` |
| Dockerfile Location | `Dockerfile` (relativo à Base Directory acima) |
| Porta exposta | `5000` |
| Domínio | `api.propostagd.digitalgenai.com.br` |
| Health Check Path | `/health` |

### Variáveis de ambiente (runtime — aba "Environment Variables")

```
DATABASE_URL=postgresql+psycopg2://<mesmo usuário/senha>@192.168.23.130:5432/galpaodesign
DB_SCHEMA=galpaodesign_teste
SECRET_KEY=<gere uma nova, NÃO reaproveite a de dev>
CORS_ALLOWED_ORIGINS=https://propostagd.digitalgenai.com.br
SESSION_COOKIE_SECURE=true
PUBLIC_BASE_URL=https://api.propostagd.digitalgenai.com.br

AWS_ACCESS_KEY_ID=<mesmo valor do .env>
AWS_SECRET_ACCESS_KEY=<mesmo valor do .env>
AWS_REGION=us-east-1
S3_BUCKET_NAME=<mesmo valor do .env>

ESPOCRM_BASE_URL=<mesmo valor do .env>
ESPOCRM_API_KEY=<mesmo valor do .env>

PROPOSTA_VOZ_WEBHOOK_SECRET=<mesmo valor do .env, se já tiver>
OPENAI_API_KEY=<mesmo valor do .env>
```

Gerar uma `SECRET_KEY` nova (não reaproveitar a de dev — são ambientes diferentes):
```
python -c "import secrets; print(secrets.token_hex(32))"
```

### Volume (armazenamento local de imagens — fallback do S3)

O código salva em `backend/uploads/` quando uma imagem é enviada sem ir direto pro S3
(`utils/image_storage.py`). Sem volume, esses arquivos **somem a cada novo deploy**
(o container é recriado do zero). Como o S3 já está configurado e é o caminho principal,
isso só afeta esse fallback — ainda assim, adicione um **Persistent Storage** no Coolify:

- Mount path no container: `/app/uploads`

### Depois de subir

Teste: `curl https://api.propostagd.digitalgenai.com.br/health` → `{"status":"ok","database":true}`

---

## 2. App do Frontend

**New Resource → Application → Dockerfile**

| Campo | Valor |
|---|---|
| Repositório | mesmo repo, mesma branch |
| Base Directory | `.` (raiz do repo) |
| Dockerfile Location | `Dockerfile` |
| Porta exposta | `80` |
| Domínio | `propostagd.digitalgenai.com.br` |

### Variável de build (⚠️ precisa estar marcada como "Build Variable"/"Available at Buildtime" no Coolify, não só runtime)

```
VITE_API_BASE_URL=https://api.propostagd.digitalgenai.com.br
```

O Vite embute essa URL no bundle **em tempo de build** (é um SPA estático) — se essa
variável só existir como env var de *runtime* do container, o build usa o valor default
do Dockerfile (`http://localhost:5000`) e o site em produção tenta falar com
`localhost`, quebrando tudo. Confirme que está marcada como disponível no build antes
de disparar o deploy.

Não precisa de outras variáveis — o frontend depois de buildado é só HTML/JS/CSS estático
servido pelo nginx.

---

## 3. Ordem de deploy e checklist final

1. Suba o **backend** primeiro, confirme `/health` respondendo antes de seguir.
2. Suba o **frontend** (com `VITE_API_BASE_URL` já apontando pro domínio do backend).
3. Teste o login real em `https://propostagd.digitalgenai.com.br`.
4. Se der "Failed to fetch" no login: confira se `CORS_ALLOWED_ORIGINS` no backend
   inclui exatamente `https://propostagd.digitalgenai.com.br` (sem barra no final,
   com `https://`) — foi exatamente esse tipo de erro que apareceu no teste local em
   Docker (ver `RELATORIO_DOCKER_E_ERROS.md`).
5. Cheque os logs do backend no Coolify por qualquer erro de conexão com o Postgres
   assim que subir (confirma que a rede/VPN até `192.168.23.130` está mesmo acessível
   a partir do servidor do Coolify).

## Modo Docker Compose (o que realmente aconteceu)

Se o Coolify detectou o `docker-compose.yml` e criou os serviços `backend`/`frontend` como um
recurso "Docker Compose" único, cada serviço tem sua própria tela com campos de **Domains** e
**Port** (às vezes chamado "Port"/"Exposes").

**O gotcha:** o `docker-compose.yml` mapeia `"8090:80"` (frontend) e `"5000:5000"` (backend) —
isso é `porta-do-host:porta-do-container`, só relevante pra testar local (`docker compose up`
na sua máquina). O Traefik do Coolify fala com o container **pela rede interna do Docker**,
então o campo "Port" de cada serviço precisa ser a porta **de dentro do container**, não a do
host:

| Serviço | Port (Traefik) | Domains |
|---|---|---|
| `frontend` | `80` | `https://propostagd.digitalgenai.com.br` |
| `backend` | `5000` | `https://api.propostagd.digitalgenai.com.br` |

Se o campo Port vier com `8090` (a porta do host) em vez de `80`, o Traefik encontra o domínio
mas não acha nada escutando ali dentro do container — resultado: `503 no available server` (ou
`404 page not found` se nem o redirect http→https tiver sido gerado). Foi exatamente isso que
aconteceu no primeiro deploy. Corrigido o campo, é preciso **redeploy** pra o Traefik regenerar
a rota.

### Gotcha #2 (o que realmente travou): o campo "Domains" precisa do `https://` na frente

Preencher o campo só com o domínio puro (`propostagd.digitalgenai.com.br`, sem esquema) faz o
Coolify gerar um label de Traefik quebrado — confirmado inspecionando o container direto
(`docker inspect ... --format "{{json .Config.Labels}}"` no servidor):

```
traefik.http.routers...rule = "Host(``) && PathPrefix(`propostagd.digitalgenai.com.br`)"
```

Repare: `Host()` fica **vazio** e o domínio inteiro vira `PathPrefix` — o Coolify não conseguiu
separar o host do resto porque faltou o esquema (mesmo efeito de rodar `urlparse` numa string
sem `http(s)://`: tudo cai em "path", nada em "host"). Uma regra assim nunca casa com request
nenhum → sempre `no available server`.

**Correção:** os dois campos precisam da URL completa, com esquema:

- Domains for backend: `https://api.propostagd.digitalgenai.com.br`
- Domains for frontend: `https://propostagd.digitalgenai.com.br`

Depois de corrigir, salvar e dar **Redeploy** de novo.

### Gotcha #3: chamadas ao CRM (Arquitetos) travando em SSL, depois em 401

O domínio público do CRM (`crm.galpaodesign.digitalgenai.com.br`, porta 80) redireciona pra
`https://crm.galpaodesign.digitalgenai.com.br:10443` — só que essa porta 10443 é a interface
administrativa de um **pfSense** (firewall/roteador da rede), não o CRM de verdade. O CRM real
roda num container Apache que só é alcançável hoje via rede interna do Docker, não pelo
caminho público (confirmado via `docker ps`/`docker exec` no servidor Coolify).

**Cuidado:** esse mesmo servidor Coolify tem DOIS CRMs diferentes rodando (containers
`galpaocrm-*` e `engajacrm-*`, de clientes/projetos diferentes) — o nome no código/env
(`ESPOCRM_*`, comentários mencionando "EngajaCRM") é só histórico e **engana**: o CRM de
verdade usado por este projeto é o **`galpaocrm-*`**, confirmado testando a API key direto
contra cada um (a `engajacrm-*` aceitava a conexão de rede mas rejeitava a chave com 401 sem
motivo aparente — só ficou claro comparando com o outro container).

**Correção aplicada:** `docker-compose.yml` conecta o serviço `backend` na rede Docker do
container do CRM (`ogp0hz5e5w54emcqoccjmt10_galpaocrm-net`, externa — já existe, criada pelo
compose do próprio CRM) e `ESPOCRM_BASE_URL` em produção aponta pro **nome do container**
(`http://galpaocrm-ogp0hz5e5w54emcqoccjmt10-124436523785`), não pro domínio público —
contornando o redirect quebrado e o firewall inteiramente, por dentro da rede do Docker.

Se o recurso do CRM for excluído/recriado no Coolify no futuro, o nome dessa rede e do
container mudam — repita a investigação (`docker ps --format "{{.Names}}" | grep -i galpaocrm`,
depois `docker inspect` pra achar a rede) e atualize `galpaocrm-net` no `docker-compose.yml` e
`ESPOCRM_BASE_URL` no Coolify.

## Sobre o banco em produção

O schema do Postgres não é gerenciado por migration automática no deploy — segue o mesmo
processo manual de sempre. Se o servidor de produção apontar pra um banco novo/diferente do
de dev, rode `python -m alembic stamp head` nele antes (ver `backend/migrations/README.md`)
pra alinhar com o schema atual sem tentar recriar nada.

Nenhuma delas bloqueia o deploy, mas valem a pena resolver logo depois de colocar no ar.
