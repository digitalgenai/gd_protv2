FROM python:3.12-slim

WORKDIR /app

# libpq-dev/gcc cobrem o caso raro de não haver wheel pronta pra essa plataforma
# (psycopg2-binary normalmente já vem compilado, isso é só um fallback seguro).
RUN apt-get update && apt-get install -y --no-install-recommends \
      libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN mkdir -p uploads

EXPOSE 5000

# Variáveis reais (DATABASE_URL, SECRET_KEY, etc.) vêm de fora do container (docker-compose
# env_file / --env-file) — nada de segredo é copiado pra dentro da imagem.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--timeout", "60", "app:app"]
