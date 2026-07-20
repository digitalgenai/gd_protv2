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
# gthread (não sync): worker sync trava 1 request por vez, então 2 workers = só 2 requests
# simultâneas — quando as duas ficam presas numa query lenta/travada, o app inteiro congela
# (Gateway Timeout). Com gthread, cada worker atende várias requests em threads; a scoped_session
# é thread-local, então cada thread tem sua própria sessão (seguro). 3 workers × 4 threads = 12
# requests simultâneas. graceful-timeout garante que um worker travado seja reciclado.
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--worker-class", "gthread", \
     "--workers", "3", "--threads", "4", "--timeout", "60", "--graceful-timeout", "30", "app:app"]
