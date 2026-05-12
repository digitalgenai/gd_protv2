# Mapeamento de Alterações — Migração de Imagens para Amazon S3

**Escopo:** Substituição do armazenamento local de imagens de produtos por Amazon S3.
**Origem da decisão:** RF008 — O sistema deve permitir upload manual de imagens por produto.
**Data:** Abril/2026

---

## Resumo das decisões

| Decisão | Conclusão |
|---|---|
| Armazenamento de imagens (arquivos binários) | **Amazon S3** |
| Banco de dados | **PostgreSQL — sem alteração** |
| ORM / acesso ao banco | **SQLAlchemy — sem alteração** |
| Google Drive | **Mantido apenas para planilhas de produtos** |
| Geração de PDF (Chromium + wkhtmltopdf + Jinja2) | **Sem alteração** |
| Geração de XLSX (XlsxWriter) | **Sem alteração (imagens não são embutidas)** |
| Worker de ingestão (`main.py`) | **Sem alteração** |

---

## Visão geral do que muda

```
ANTES
Upload → disco local (_tmp/uploads/<codigo>/<arquivo>)
         ↓
         banco: storage_path = "/caminho/local/foto.jpg"
         ↓
GET /images/<codigo>/<arquivo> → Flask serve o arquivo do disco

DEPOIS
Upload → Amazon S3 (bucket/<prefix>/<codigo>/<arquivo>)
         ↓
         banco: storage_path = "https://bucket.s3.amazonaws.com/<prefix>/<codigo>/<arquivo>"
         ↓
URL pública do S3 serve a imagem diretamente (sem passar pelo Flask)
```

---

## Arquivos alterados

### 1. `requirements.txt`

**O que muda:** adicionar a biblioteca oficial da AWS.

```diff
+ boto3
```

**Por quê:** `boto3` é a biblioteca Python oficial para interagir com todos os serviços AWS, incluindo o S3. É madura, amplamente usada e mantida pela própria Amazon.

---

### 2. `.env.example`

**O que muda:** adicionar as variáveis de configuração do S3.

```diff
+ # ====== Amazon S3 ======
+ AWS_ACCESS_KEY_ID=
+ AWS_SECRET_ACCESS_KEY=
+ AWS_REGION=us-east-1
+ AWS_S3_BUCKET=
+ AWS_S3_PREFIX=uploads
+ AWS_S3_PUBLIC_BASE_URL=
```

**Observação sobre `AWS_S3_PUBLIC_BASE_URL`:** se o bucket for público, a URL base é
`https://<bucket>.s3.<region>.amazonaws.com`. Pode ser sobrescrita por uma URL de CDN (ex: CloudFront) sem alterar código.

---

### 3. `utils/s3_storage.py` ← **ARQUIVO NOVO**

**Por quê criar:** isola toda a lógica de S3 em um único lugar. O `app.py` chama funções simples e não sabe como o S3 funciona internamente. Facilita troca futura (ex: GCS, R2) sem tocar no app.

**Funções a criar:**

```python
def upload_image(codigo: str, filename: str, data: bytes, mime: str) -> str:
    """
    Envia os bytes da imagem para o S3.
    Retorna a URL pública do arquivo.
    """

def delete_image(storage_url: str) -> None:
    """
    Remove o objeto do S3 a partir da URL pública.
    """

def s3_key_from_url(storage_url: str) -> str:
    """
    Extrai a chave S3 (path dentro do bucket) a partir da URL pública.
    Uso interno para operações de deleção.
    """
```

---

### 4. `app.py`

É o arquivo com mais mudanças. As alterações estão agrupadas por bloco.

#### 4.1 — Remover configuração de disco local

**Linhas atuais (~59–60):**
```python
IMAGES_DIR = os.getenv("IMAGES_UPLOAD_DIR", os.path.abspath("_tmp/uploads"))
os.makedirs(IMAGES_DIR, exist_ok=True)
```

**O que muda:** essas duas linhas são removidas. O diretório local deixa de existir para imagens.

---

#### 4.2 — Remover função `_image_storage_paths()`

**Linhas atuais (~133–137):**
```python
def _image_storage_paths(codigo: str) -> str:
    safe_code = re.sub(r"[^A-Za-z0-9._-]+", "_", codigo).strip("_") or "sem_codigo"
    folder = os.path.join(IMAGES_DIR, safe_code)
    os.makedirs(folder, exist_ok=True)
    return folder
```

**O que muda:** função removida. A lógica de "onde guardar" passa para `utils/s3_storage.py`.

---

#### 4.3 — Alterar função `_public_image_url()`

**Linhas atuais (~139–141):**
```python
def _public_image_url(codigo: str, filename: str) -> str:
    safe_code = re.sub(r"[^A-Za-z0-9._-]+", "_", codigo).strip("_") or "sem_codigo"
    return f"/images/{safe_code}/{filename}"
```

**O que muda:** passa a retornar a URL pública do S3, que agora vem direto do banco (`storage_path`). A função pode ser simplificada ou eliminada, já que a URL completa é gravada no banco na hora do upload.

---

#### 4.4 — Alterar rota `POST /produtos/<codigo>/imagens`

**Bloco atual (linhas ~1505–1533):**

```python
# salva em disco   ← REMOVE
folder = _image_storage_paths(codigo)
base = os.path.splitext(secure_filename(storage_file.filename or "imagem"))[0] or "imagem"
ext = os.path.splitext(storage_file.filename or "")[1].lower() or ".jpg"
fname = _safe_filename(base, ext)
path = os.path.join(folder, fname)
with open(path, "wb") as f:
    f.write(data)

# registra no banco
...
"storage_path": path,   ← MUDA: passa a ser a URL pública do S3
```

**O que muda:**

```python
# salva no S3   ← NOVO
from utils.s3_storage import upload_image

fname = _safe_filename(base, ext)
public_url = upload_image(codigo, fname, data, metrics.get("mime", "image/jpeg"))

# registra no banco
...
"storage_path": public_url,   ← URL pública do S3
```

---

#### 4.5 — Alterar rota `DELETE /produtos/<codigo>/imagens/<image_id>`

**Bloco atual (linhas ~1592–1596):**
```python
try:
    if row["storage_path"] and os.path.isfile(row["storage_path"]):
        os.remove(row["storage_path"])
except Exception:
    pass
```

**O que muda:**
```python
# deleta do S3   ← NOVO
from utils.s3_storage import delete_image

try:
    if row["storage_path"]:
        delete_image(row["storage_path"])
except Exception:
    pass
```

---

#### 4.6 — Remover rota `GET /images/<codigo>/<path:fname>`

**O que muda:** essa rota existe para servir arquivos do disco. Com S3, a URL pública já serve a imagem diretamente, sem passar pelo servidor Flask. A rota pode ser removida.

**Atenção:** antes de remover, confirmar que o front-end não tem URLs hardcoded com `/images/`. Se tiver, a URL precisa ser atualizada para apontar para o S3.

---

#### 4.7 — Alterar `_first_image_path_for_codes()` e `_thumbnail_url_map()`

**Linhas ~183–212:** essas funções consultam `storage_path` e `filename` do banco para montar URLs de thumbnail.

Com S3, o `storage_path` já é a URL pública completa. As funções ficam mais simples — não precisam mais montar URL via `_public_image_url()`.

```python
# Thumbnail passa a ser direto do storage_path
first[c] = r["storage_path"]   # URL S3 completa
```

---

### 5. `docker-compose.yml`

**O que muda:** o volume de imagens uploadadas deixa de ser necessário, pois os arquivos vão para o S3.

```diff
  volumes:
    - .:/app
    - ./credentials.json:/app/credentials.json:ro
    - ./imagens_extraidas:/app/imagens_extraidas
    - ./planilhas_baixadas:/app/planilhas_baixadas
    - ./pdfs_baixados:/app/pdfs_baixados
-   # _tmp/uploads não precisa mais de volume persistente
```

**Observação:** as pastas de planilhas e PDFs gerados continuam sendo necessárias.

---

### 6. `db/init/init.sql` — Sem alteração estrutural

A coluna `storage_path` na tabela `produtos_imagens` **não muda de nome nem de tipo** (continua `TEXT`). Muda apenas o que é gravado nela:

| Situação | Valor de `storage_path` |
|---|---|
| Antes | `/app/_tmp/uploads/COD001/foto_abc123.jpg` |
| Depois | `https://bucket.s3.us-east-1.amazonaws.com/uploads/COD001/foto_abc123.jpg` |

---

### 7. Arquivos sem alteração

| Arquivo | Motivo |
|---|---|
| `main.py` | Lida apenas com planilhas do Drive, não com imagens |
| `utils/pdf_generator.py` | Já baixa imagens via HTTP — URL do S3 funciona igual |
| `utils/excel_generator.py` | Não embute imagens nos arquivos gerados |
| `utils/ai_generator.py` | Não interage com imagens |
| `mapear_colunas.py` | Sem relação com imagens |
| `templates/base.html` | Recebe URLs prontas — S3 ou local, indiferente |

---

## Script de migração (execução única)

**Arquivo a criar:** `scripts/migrar_imagens_s3.py`

Este script é executado **uma única vez** para migrar as imagens que já existem no disco para o S3 e atualizar o banco.

**Fluxo do script:**
```
1. Conecta ao PostgreSQL
2. Busca todos os registros de produtos_imagens (storage_path com caminho local)
3. Para cada registro:
   a. Lê o arquivo do disco (storage_path local)
   b. Faz upload para o S3
   c. Atualiza o storage_path no banco com a URL pública do S3
4. Loga sucessos e falhas
5. Ao final, exibe resumo (X migrados, Y falhas)
```

---

## Ordem de execução sugerida

```
1. Criar conta/bucket S3 e gerar as credenciais AWS
2. Adicionar variáveis AWS ao .env
3. Instalar boto3 (requirements.txt)
4. Criar utils/s3_storage.py
5. Criar scripts/migrar_imagens_s3.py
6. Executar o script de migração em ambiente de teste
7. Validar URLs no banco
8. Alterar app.py (upload, delete, public_url)
9. Remover rota GET /images (após confirmar front-end)
10. Atualizar docker-compose.yml
11. Deploy e validação em produção
```

---

## Riscos e pontos de atenção

| Risco | Mitigação |
|---|---|
| Front-end com URLs `/images/...` hardcoded | Verificar antes de remover a rota |
| Bucket S3 privado quebra PDF/XLSX | Manter bucket público para leitura, ou usar URLs pré-assinadas com TTL longo |
| Falha no upload S3 durante o request | Tratar exceção e retornar erro ao cliente — não gravar no banco se o S3 falhou |
| Script de migração interrompe a meio | Fazer verificação de `storage_path` já iniciando com `https://` para pular registros já migrados |
| Credenciais AWS no .env sem rotação | Usar IAM Role com permissão mínima (só `s3:PutObject`, `s3:DeleteObject`, `s3:GetObject` no bucket específico) |
