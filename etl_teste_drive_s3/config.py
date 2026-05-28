import os
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Google
# ---------------------------------------------------------------------------
CREDENTIALS_PATH = os.getenv("GOOGLE_CREDENTIALS_PATH", "credentials.json")

# ID da pasta PRODUTOS no Drive (contém as imagens)
DRIVE_IMAGES_FOLDER_ID = "15wplYybUU1D3iP5UHyU8sOLY1DZB6z3S"

# ID da pasta de fornecedores no Drive (contém as planilhas)
# Abra a pasta no navegador e copie o ID da URL: drive.google.com/drive/folders/<ID>
DRIVE_SPREADSHEETS_FOLDER_ID = os.getenv("DRIVE_SPREADSHEETS_FOLDER_ID", "")

# ---------------------------------------------------------------------------
# AWS
# ---------------------------------------------------------------------------
AWS_ACCESS_KEY_ID     = os.getenv("AWS_ACCESS_KEY_ID", "")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
AWS_REGION            = os.getenv("AWS_REGION", "us-east-1")
S3_BUCKET_NAME        = os.getenv("S3_BUCKET_NAME", "")

# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------
# Score mínimo (0–100) para considerar um match válido.
# Abaixo disso a linha vai para a aba "Sem match" no relatório.
SIMILARITY_THRESHOLD = 70

# Scores de corte para os níveis de confiança exibidos no relatório
HIGH_CONFIDENCE_THRESHOLD   = 88   # >= 88 → Alta (verde)
MEDIUM_CONFIDENCE_THRESHOLD = 75   # 75–87 → Média (amarelo) | < 75 → Baixa (vermelho)

# Diferença mínima entre 1º e 2º candidato para não sinalizar como ambíguo
AMBIGUITY_GAP = 5

# ---------------------------------------------------------------------------
# Extensões de imagem a processar
# ---------------------------------------------------------------------------
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".svg"}

# ---------------------------------------------------------------------------
# Nomes de colunas que provavelmente contêm o SKU/nome do produto
# (comparação case-insensitive, sem acentos)
# ---------------------------------------------------------------------------
SKU_COLUMN_NAMES = [
    "referência", "referencia", "ref",
    "modelo", "model",
    "cód", "cod", "código", "codigo",
    "sku", "produto", "product",
    "nome", "name", "item",
    "descrição", "descricao", "description",
]

# ---------------------------------------------------------------------------
# Palavras-chave nas abas que indicam que não contêm dados de produto
# ---------------------------------------------------------------------------
TABS_TO_SKIP_KEYWORDS = [
    "capa", "condição", "condicao", "política", "politica",
    "financeiro", "acabamento", "tecido fornecido", "classificação",
    "manutenção", "manutencao", "markup", "metragem", "informação",
    "atualização", "atualizacao", "plan1", "plan2", "planilha1",
    "gráf", "graf", "cálculo", "calculo",
]

# ---------------------------------------------------------------------------
# Pasta que identifica a tabela atual dentro de cada fornecedor
# ---------------------------------------------------------------------------
# "atuai" é substring de "Atuais" — não usar "atual" pois NÃO é substring de "atuais"
CURRENT_TABLE_KEYWORD = "atuai"

# ---------------------------------------------------------------------------
# Mapeamento direto de código de fornecedor → nome do fornecedor
# Extraído do padrão "PRODUTO1 - CODIGO.jpg" nos nomes das imagens
# ---------------------------------------------------------------------------
SUPPLIER_CODE_MAP = {
    # Fornecedores confirmados nas planilhas
    "JAL": "Sollos",                   # Jader Almeida — Studio Sollos
    "GOT": "Gottems",                  # Gottems
    "FEE": "Feeling",                  # Feeling Estofados
    "PIU": "PiuMobile",                # Piu Mobile
    "MSU": "MSUL",                     # MSUL
    "DFL": "Dona Flor",                # Dona Flor
    "BCO": "Brazil Contemporaneo",     # Brazil Contemporaneo

    # Outros fornecedores/marcas identificados nas imagens (sem planilha mapeada ainda)
    # Adicione o nome correto conforme for identificando cada código
    "API": None,    # desconhecido — 20 imgs em LIVING
    "ARG": None,    # desconhecido — 3 imgs em *ITALIANOS
    "ARPER": None,  # Arper (marca italiana) — 4 imgs
    "ART": None,    # desconhecido — 7 imgs em *ITALIANOS
    "ATOI": None,   # desconhecido — 2 imgs em IN&OUT
    "BDE": None,    # desconhecido — 4 imgs em LIVING
    "BEL": None,    # desconhecido — 9 imgs em OFFICE
    "BTZE": None,   # desconhecido — 1 img em IN&OUT
    "BTZK": None,   # desconhecido — 12 imgs em IN&OUT
    "BUX": None,    # desconhecido — 3 imgs em IN&OUT
    "DOM": None,    # desconhecido — 3 imgs em LIVING
    "DRI": None,    # Driade? — 6 imgs em LIVING/*ITALIANOS
    "EBO": None,    # desconhecido — 1 img em LIVING
    "ELE": None,    # desconhecido — 2 imgs em LIVING
    "ESC": None,    # desconhecido — 31 imgs em LIVING
    "EST": None,    # desconhecido — 3 imgs em LIVING
    "EVI": None,    # desconhecido — 3 imgs em LIVING
    "FBR": None,    # desconhecido — 3 imgs em LIVING
    "FKS": None,    # desconhecido — 8 imgs em LIVING
    "FOL": None,    # desconhecido — 9 imgs em IN&OUT/LIVING
    "FOLIO": None,  # desconhecido — 1 img em LIVING
    "GAB": None,    # Gabriella? — 3 imgs em *ITALIANOS
    "GBO": None,    # desconhecido — 4 imgs em LIVING
    "GRH": None,    # desconhecido — 6 imgs em IN&OUT
    "ITA": None,    # desconhecido — 3 imgs em LIVING
    "JEL": None,    # desconhecido — 2 imgs em LIVING
    "JZA": None,    # desconhecido — 10 imgs em LIVING
    "LBA": None,    # desconhecido — 2 imgs em LIVING
    "LDS": None,    # desconhecido — 1 img em LIVING
    "LIN": None,    # desconhecido — 4 imgs em LIVING
    "LRO": None,    # desconhecido — 27 imgs em LIVING
    "MAG": None,    # Magis? — 10 imgs em *ITALIANOS
    "MBO": None,    # desconhecido — 5 imgs em LIVING
    "MCO": None,    # desconhecido — 7 imgs em LIVING
    "MOO": None,    # Moooi? — 7 imgs em *ITALIANOS
    "MOR": None,    # desconhecido — 3 imgs em *ITALIANOS
    "MPR": None,    # desconhecido — 28 imgs em LIVING
    "MRM": None,    # desconhecido — 2 imgs em *ITALIANOS
    "NZU": None,    # desconhecido — 2 imgs em LIVING
    "ONI": None,    # desconhecido — 2 imgs em LIVING
    "ONN": None,    # desconhecido — 4 imgs em LIVING
    "PFR": None,    # desconhecido — 15 imgs em LIVING
    "PLA": None,    # desconhecido — 10 imgs em LIVING
    "PMO": None,    # desconhecido — 4 imgs em LIVING
    "PRO": None,    # desconhecido — 13 imgs em LIVING
    "PUS": None,    # desconhecido — 4 imgs em LIVING
    "QEE": None,    # desconhecido — 8 imgs em *ITALIANOS
    "QFC": None,    # desconhecido — 2 imgs em LIVING
    "RBA": None,    # desconhecido — 81 imgs em LIVING
    "RES": None,    # desconhecido — 3 imgs em LIVING
    "RIZ": None,    # desconhecido — 2 imgs em LIVING
    "SLI": None,    # Slinq? — 11 imgs em *ITALIANOS
    "TCU": None,    # desconhecido — 6 imgs em LIVING
    "TIS": None,    # desconhecido — 26 imgs em LIVING
    "UNQ": None,    # desconhecido — 2 imgs em IN&OUT
    "ZAN": None,    # desconhecido — 5 imgs em IN&OUT
}

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
ANALYSIS_REPORT_PATH = "relatorio_analise.xlsx"
