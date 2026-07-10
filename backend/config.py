import os
from pathlib import Path
from dotenv import load_dotenv

# .env vive na raiz do projeto (um nível acima de backend/), mesmo arquivo usado pelo Vite.
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
load_dotenv(PROJECT_ROOT / ".env")

DATABASE_URL = os.environ["DATABASE_URL"]
DB_SCHEMA = os.environ.get("DB_SCHEMA", "galpaodesign_teste")
UPLOADS_DIR = BASE_DIR / "uploads"
# Base pública deste servidor Flask — usada para transformar um storage_path local
# (ex.: "/images/GD-0001/foto.jpg") em URL absoluta consumível pelo front (porta diferente).
# URLs já no S3 (https://...) não passam por aqui, seguem como estão.
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "http://localhost:5000")

# AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY não são lidos aqui de propósito — o boto3 já
# procura essas duas variáveis de ambiente automaticamente (credential chain padrão),
# então load_dotenv() já é suficiente pra elas chegarem no processo.
AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
AWS_S3_BUCKET = os.environ.get("S3_BUCKET_NAME") or os.environ.get("AWS_S3_BUCKET")
AWS_S3_PREFIX = os.environ.get("AWS_S3_PREFIX", "uploads")

MIN_IMAGE_DIMENSION = 600
MAX_IMAGES_PER_PRODUCT = 3
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MIN_IMAGE_SIZE_BYTES = 50 * 1024
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
