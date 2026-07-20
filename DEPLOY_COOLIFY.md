# Deploy no Coolify — propostagd.digitalgenai.com.br

Dois apps separados no Coolify, cada um usando os Dockerfiles já existentes no repo
(`backend/Dockerfile` e `Dockerfile` na raiz) — sem precisar do `docker-compose.yml`
(esse arquivo é só pra rodar local/testar).

- **Frontend** → `propostagd.digitalgenai.com.br`
- **Backend (API)** → `api.propostagd.digitalgenai.com.br`

Confirmado com você: o Postgres em `192.168.23.130` continua acessível a partir de onde o
Coolify roda (mesma rede/VPN) — nenhuma mudança de `DATABASE_URL` necessária.

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

## Sobre o banco em produção

O schema do Postgres não é gerenciado por migration automática no deploy — segue o mesmo
processo manual de sempre. Se o servidor de produção apontar pra um banco novo/diferente do
de dev, rode `python -m alembic stamp head` nele antes (ver `backend/migrations/README.md`)
pra alinhar com o schema atual sem tentar recriar nada.

Nenhuma delas bloqueia o deploy, mas valem a pena resolver logo depois de colocar no ar.
