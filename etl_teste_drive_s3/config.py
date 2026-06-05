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
# Sentinel para códigos cujas imagens devem ser descartadas (não vão para o S3)
EXCLUIR = "__EXCLUIR__"

SUPPLIER_CODE_MAP = {
    # Fornecedores confirmados nas planilhas
    "JAL": "Sollos",                   # Jader Almeida — Studio Sollos
    "GOT": "Gottems",                  # Gottems
    "FEE": "Feeling",                  # Feeling Estofados
    "PIU": "PiuMobile",                # Piu Mobile
    "MSU": "MSUL",                     # MSUL
    "DFL": "Dona Flor",                # Dona Flor
    "BCO": "Brazil Contemporaneo",     # Brazil Contemporaneo

    # Códigos identificados e confirmados na revisão do relatório
    "API": "Aristeu Pires",
    "ARG": EXCLUIR,
    "ARPER": "Arper",
    "ART": "Artemide",
    "ATOI": "Atelier Oi",
    "BDE": "Bell Design",
    "BEL": EXCLUIR,
    "BTZE": EXCLUIR,
    "BTZK": "Butzke",
    "BUX": "Bux",
    "DOM": "Domum",
    "DRI": "Drio",
    "EBO": "Edu Bortolai",
    "ELE": "Estudio Legna",
    "ESC": "Escal",
    "EST": "Estobel",
    "EVI": "Estudio Vira",
    "FBR": "Forma Bruta",
    "FKS": "Fakazaka",
    "FOL": "Folio",
    "FOLIO": "Folio",
    "GAB": "Gaber",
    "GBO": "Giorgio Bonaguro",
    "ITA": "Ita Cadeiras",
    "JEL": "Jorge Elmor",
    "JZA": "Jorge Zalszupin",
    "LBA": "Lara Batista",
    "LDS": "Luan Del Savio",
    "LIN": "Linear",
    "LRO": "Leo Romano",
    "MAG": "Magis",
    "MBO": "Mauricio Bonfim",
    "MCO": "Mauricio Coelho",
    "MOO": "Moooi",
    "MOR": "Moroso",
    "MPR": "Mula Preta",
    "MRM": "Mr. Maria",
    "NZU": "Nika Zupanc",
    "ONI": "Oscar Niemeyer",
    "ONN": "Onna Móveis",
    "PFR": "Pedro Franco",
    "PLA": "Percival Lafer",
    "PMO": "Punto Mobile",
    "PRO": "Prototype",
    "PUS": EXCLUIR,
    "QEE": "Qeeboo",
    "QFC": "Quintino Facci",
    "RBA": "Roberta Banqueri",
    "RES": EXCLUIR,
    "RIZ": "Rizzon",
    "SLI": "Slide",
    "TCU": "Tiago Curioni",
    "TIS": "Tissot",
    "UNQ": "Unique / BTZK",
    "ZAN": "Zanine",
}

# Códigos cujas imagens são descartadas no agrupamento/upload
EXCLUDED_CODES = {c for c, v in SUPPLIER_CODE_MAP.items() if v == EXCLUIR}

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
ANALYSIS_REPORT_PATH = "relatorio_analise.xlsx"
