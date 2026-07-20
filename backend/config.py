import os
from pathlib import Path
from dotenv import load_dotenv

# .env vive na raiz do projeto (um nível acima de backend/), mesmo arquivo usado pelo Vite.
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.environ.get("DB_SCHEMA", "galpaodesign_teste")
# Assina o cookie de sessão (login). Defina SECRET_KEY no .env em qualquer ambiente real —
# este fallback é só pra dev local não travar; com ele, reiniciar o servidor derruba as sessões.
SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-insecure-secret-troque-em-producao")
# Cookie de sessão só viaja em HTTPS quando True — precisa disso em produção atrás de https,
# mas teria que ficar False em dev local (http puro) senão o navegador nunca envia o cookie.
SESSION_COOKIE_SECURE = os.environ.get("SESSION_COOKIE_SECURE", "false").strip().lower() == "true"
UPLOADS_DIR = BASE_DIR / "uploads"
# Base pública deste servidor Flask — usada para transformar um storage_path local
# (ex.: "/images/GD-0001/foto.jpg") em URL absoluta consumível pelo front (porta diferente).
# URLs já no S3 (https://...) não passam por aqui, seguem como estão.
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5000")

# Origens autorizadas a chamar esta API com cookies (Flask-CORS) — lista separada por vírgula.
# O default cobre só o Vite em dev (:5173); qualquer outra origem (build via Docker/nginx,
# domínio de produção, etc.) precisa estar aqui ou toda chamada autenticada falha em silêncio
# no browser (a resposta chega, mas sem header CORS o JS nunca lê — visto como "Failed to
# fetch" no front, mesmo com o backend respondendo 200).
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# EngajaCRM (EspoCRM) — arquitetos são a entidade "Account" de lá (ver mcp-engajacrm/README.md).
ESPOCRM_BASE_URL = os.environ.get("ESPOCRM_BASE_URL", "").rstrip("/")
ESPOCRM_API_KEY = os.environ.get("ESPOCRM_API_KEY", "")

# RF-059 — segredo compartilhado que o sistema externo de transcrição de voz (Whisper/OpenAI)
# deve mandar no header X-Webhook-Secret ao chamar POST /webhook/proposta-voz. Sem isso
# configurado, o endpoint recusa qualquer chamada (ver routes/voz.py).
PROPOSTA_VOZ_WEBHOOK_SECRET = os.environ.get("PROPOSTA_VOZ_WEBHOOK_SECRET", "")

# Transcrição (Whisper) + extração estruturada (chat completion) da gravação feita direto no
# navegador — ver utils/openai_client.py. Casamento de produto usa pg_trgm (já instalado no
# banco), não embedding — não depende de nenhuma extensão nova.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

# AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY não são lidos aqui de propósito — o boto3 já
# procura essas duas variáveis de ambiente automaticamente (credential chain padrão),
# então load_dotenv() já é suficiente pra elas chegarem no processo.
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_S3_BUCKET = os.environ.get("S3_BUCKET_NAME") or os.environ.get("AWS_S3_BUCKET")
AWS_S3_PREFIX = os.environ.get("AWS_S3_PREFIX", "uploads")

MIN_IMAGE_DIMENSION = 600
# As 3 primeiras posições são os slots "curados" fixos (1 = produto isolado, 2/3 = ambiente)
# mostrados na grade principal do modal — MAX_TOTAL_IMAGES_PER_PRODUCT é o teto geral de
# upload (inclui essas 3 + as extras enviadas pelo botão "Adicionar mais imagens").
MAX_IMAGES_PER_PRODUCT = 3
MAX_TOTAL_IMAGES_PER_PRODUCT = 20
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIN_IMAGE_SIZE_BYTES = 50 * 1024
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
