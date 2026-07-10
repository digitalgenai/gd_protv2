# ETL Galpão Design — Imagens de Produtos → S3

Pipeline que associa **imagens de produtos** (Google Drive) aos seus **fornecedores e SKUs**
(planilhas de fornecedor, também no Drive), gera um relatório versionado para revisão humana e,
depois de aprovado, faz o **upload organizado das imagens para o AWS S3**, produzindo um
**manifesto** (`manifesto_s3.csv`) que liga `Drive → S3 → URL` — pronto para ser carregado num
banco PostgreSQL numa etapa posterior.

---

## Índice

1. [Visão geral](#1-visão-geral)
2. [Arquivos do projeto](#2-arquivos-do-projeto)
3. [Fase 1 — Matching (`phase1_match.py`)](#3-fase-1--matching)
4. [Critérios de match (definitivos)](#4-critérios-de-match-definitivos)
5. [Fase 2 — Upload para o S3 (`phase2_upload.py`)](#5-fase-2--upload-para-o-s3)
6. [Por que 2.272 imagens e só 290 no S3](#6-por-que-2272-imagens-e-só-290-no-s3)
7. [Bugs encontrados e corrigidos](#7-bugs-encontrados-e-corrigidos)
8. [Dificuldades (e como foram tratadas)](#8-dificuldades-e-como-foram-tratadas)
9. [Configuração do S3 e segurança](#9-configuração-do-s3-e-segurança)
10. [Como rodar](#10-como-rodar)

---

## 1. Visão geral

```
Google Drive (Planilhas)          Google Drive (PRODUTOS / imagens)
        │                                   │
        ▼                                   ▼
  Extrai SKUs por fornecedor       Extrai nome + código do nome do arquivo
        │                                   │
        └────────── Match por contenção + dupla confirmação ──────────┘
                               │
                               ▼
                  relatorio_analise_vNNN.xlsx   (revisão humana)
                               │
                               ▼ (Fase 2, após aprovação)
                  Dedup → slug → S3 + manifesto_s3.csv
                               │
                               ▼ (etapa futura, separada)
                          carga no PostgreSQL
```

O fornecedor de cada imagem vem do **código embutido no nome do arquivo**; o SKU vem do
cruzamento desse nome com as **planilhas de fornecedor**. São **dois Drives distintos**: a foto
vem do Drive de PRODUTOS; a confirmação vem do Drive de planilhas.

---

## 2. Arquivos do projeto

| Arquivo | Função |
|---|---|
| `config.py` | Configuração central: IDs do Drive, thresholds, `SUPPLIER_CODE_MAP`, `SUPPLIER_ALIASES`, AWS |
| `phase1_match.py` | Extrai SKUs, lista imagens, faz o match, gera o relatório Excel versionado |
| `phase2_upload.py` | Lê o relatório aprovado, deduplica, sobe pro S3 e grava o manifesto (tem `--dry-run`) |
| `check_sku_collisions.py` | Diagnóstico: detecta nomes de SKU iguais em fornecedores diferentes |
| `map_drives.py` | Diagnóstico: estrutura das pastas do Drive |
| `manifesto_s3.csv` | Saída da Fase 2: uma linha por imagem (Drive → S3 → URL), base para o PSQL |
| `.env` | Credenciais (Google + AWS) — nunca versionar |

---

## 3. Fase 1 — Matching

Ordem de execução em `main()`:

1. **Autentica** no Drive (service account, somente leitura).
2. **`load_all_skus`** — varre o Drive de planilhas recursivamente; só processa arquivos cujo
   caminho contém `"atuai"` (tabela vigente). O fornecedor vem do nome da pasta/arquivo, passando
   por `canonical_supplier` (aliases). De cada planilha extrai os SKUs (ver coluna abaixo) e
   **deduplica** SKUs idênticos do mesmo fornecedor.
3. **`load_all_images`** — varre o Drive de PRODUTOS; para cada imagem, `parse_image_name`
   separa **nome do produto** e **código do fornecedor**, e guarda o **`drive_id`** (id estável do
   arquivo no Drive).
4. **`match_images_to_skus`** — classifica cada imagem (ver critérios).
5. **`generate_report`** — gera `relatorio_analise_vNNN.xlsx` + `_LATEST.xlsx`.

### Identificação da coluna do SKU (`find_sku_column`)

As planilhas são heterogêneas, então a coluna do nome do produto é escolhida por **conteúdo**, não
só pelo cabeçalho:

1. Varre até **40 linhas** procurando cabeçalho (algumas planilhas têm título no topo — a Dona Flor
   só tem cabeçalho na linha 13).
2. Coluna com cabeçalho **primário** (`modelo`/`nome`) que tenha conteúdo de nome vence.
3. Senão, entre colunas com cabeçalho conhecido (`descrição`/`referência`/`cód`/`coleção`/…),
   vence a que **mais tem valores parecidos com nome de produto** (palavras, não códigos ou
   números). Isso resolve o ambíguo "Referência": na Sollos ela tem os nomes (e vence a "Descrição"
   cheia de marcadores); no Brazil Contemporaneo ela tem códigos numéricos (e perde para a "Descrição").
4. Caso especial Dona Flor: os produtos são organizados em seções por **COLEÇÃO**, e o nome que as
   imagens usam está no título `COLEÇÃO X - DESIGN Y` (coluna A), não na coluna "Descrição". Esses
   nomes de coleção são extraídos à parte.

### Relatório (6 abas, versionado)

`relatorio_analise_vNNN.xlsx` (histórico) + `_LATEST.xlsx` (sempre o mais recente). Abas:
**Análise Completa**, **Para Revisão** (conflito + ambíguo), **Sem Match**, **Resumo por
Fornecedor**, **Legenda Códigos**, **Resumo da Versão** (métricas com delta colorido vs. versão
anterior). A 1ª coluna é o **`drive_id`** (âncora estável usada pela Fase 2).

---

## 4. Critérios de match (definitivos)

> **Importante:** o match **não é por igualdade exata nem por fuzzy** (essas abordagens foram
> testadas e descartadas — ver bugs 4 e a seção de evolução abaixo). O nome da imagem é o **núcleo**
> do produto; na planilha o SKU costuma vir "embrulhado" com categoria e descritor
> (imagem `TECA` ⊂ SKU `BUFFET TECA`; imagem `WIRED` ⊂ SKU `BANCO WIRED OUTDOOR`). Por isso o match
> é por **contenção**: os tokens do nome da imagem ⊆ tokens do SKU.

Para cada imagem, classifica-se em:

| Método | Critério | Vai pro S3? |
|---|---|---|
| **confirmado** | Tem código → busca **só** na planilha do fornecedor do código e acha um SKU que contém o nome (dupla confirmação: nome + código). Havendo vários, pega o mais específico. | ✅ |
| **nome** | Sem código → nome contido em SKUs de **um único** fornecedor. | ✅ (fornecedor da planilha) |
| **sem_sku** | Nenhum SKU contém o nome. Fornecedor vem do código (se houver). | Só nível fornecedor |
| **conflito** | Nome existe, mas em fornecedor **≠** código do arquivo → revisão. *(Decisão: confiar no código → vira `sem_sku` daquele fornecedor.)* | Revisão |
| **ambiguo** | Sem código e o nome existe em **2+ fornecedores** → revisão. | Revisão |
| **excluido** | Código marcado como `__EXCLUIR__` no `config.py`. | ❌ (descartado) |

Detalhes que sustentam os critérios:

- **Dupla confirmação:** quando há código, a busca **nunca sai do fornecedor do código** — por isso
  "conflito" praticamente desaparece e não há risco de arquivar no fornecedor errado.
- **Mapa de códigos (`SUPPLIER_CODE_MAP`):** 62 códigos mapeados; 5 marcados como `__EXCLUIR__`
  (ARG, BEL, BTZE, PUS, RES).
- **Aliases de fornecedor (`SUPPLIER_ALIASES`):** resolvem casos em que o fornecedor real está no
  nome do arquivo, não na pasta:
  - `Feeling` tem 2 arquivos (incl. "Feeling Linha Madeira") → ambos viram **Feeling**.
  - A linha da **Roberta Banqueri** vem no arquivo "PIU MOBILE ROBETA BANQUERI" (dentro da PiuMobile)
    → vira **Roberta Banqueri** (e não PiuMobile).
  - Os 3 arquivos da Sollos (LIVING / IN&OUT / LIGHTING, todos "STUDIO SOLLOS") → todos viram **Sollos**.
- **Colisões entre fornecedores:** verificadas com `check_sku_collisions.py` — só **2** nomes
  colidem (`BORÁ`/`BORA`, `BOTO`, entre Feeling e PiuMobile), e o código desempata. Por isso o match
  por nome é seguro.

---

## 5. Fase 2 — Upload para o S3

`phase2_upload.py` (com `--dry-run`):

1. Lê `relatorio_analise_LATEST.xlsx` e filtra só os **confirmados**.
2. **Deduplica em dois níveis:**
   - por **`drive_id`** (mesmo arquivo do Drive listado mais de uma vez);
   - por **nome dentro do produto**, mantendo o **arquivo de maior resolução** (a mesma foto é
     re-salva em várias pastas com bytes diferentes — ver seção 6).
3. **Agrupa por produto** (`fornecedor` + `sku`) e re-sequencia as fotos `1..N`.
4. **Slug com hífen:** `fornecedor-slug/sku-slug/seq.ext`
   (ex.: `sollos/poltrona-ella/1.jpg`). O slug remove acento, `(parênteses)`, `•` e pontuação.
5. **`--dry-run`:** mede o tamanho total pela **metadata do Drive** (campo `size`, sem baixar nem
   subir nada) e grava `manifesto_s3_preview.csv`. Custo zero.
6. **Upload real:** baixa do Drive, `put_object` no S3, grava `manifesto_s3.csv` com a `s3_url`,
   `etag`, `md5` e `status`. É **idempotente** — re-rodar pula o que já está no manifesto.

### Manifesto (`manifesto_s3.csv`)

Uma linha por imagem; colunas: `image_id` (drive_id), `arquivo_original`, `caminho_drive`,
`fornecedor`, `fornecedor_slug`, `sku`, `sku_slug`, `codigo`, `seq`, `md5`, `s3_key`, `s3_url`,
`etag`, `status`, `versao`, `enviado_em`. Produtos com o mesmo `(fornecedor_slug, sku_slug)` são o
mesmo produto, com várias URLs. **A Fase 2 não toca no PostgreSQL** — o manifesto é o artefato que
a carga futura no banco vai consumir (o banco gera o id interno e guarda as URLs).

### Resultado do upload

**290 imagens · 104 produtos · ~467 MB · custo de armazenamento ≈ US$ 0,011/mês.** 290 enviadas,
0 erros.

---

## 6. Por que 2.272 imagens e só 290 no S3

Esta é a pergunta central. A resposta tem duas partes: **duplicação** e **dado que falta**.

**Total de imagens no Drive de PRODUTOS: 2.272.**

**Confirmadas (fornecedor + SKU): 409 linhas no relatório** — mas essas 409 **não são 409 fotos
distintas**. A mesma foto aparece replicada em várias pastas de categoria do Drive. Exemplo real: o
produto "Banqueta Doty" tinha 30 linhas, mas só os nomes `DOTY1` e `DOTY2` — ou seja, **2 fotos
reais**, cada uma copiada ~14 vezes.

Investigação da duplicação:
- Dedup por **`drive_id`**: continua 409 — são arquivos tecnicamente distintos no Drive.
- Dedup por **`md5`** (conteúdo): removeu só **1** — as cópias **não são byte-a-byte idênticas**;
  é a mesma foto **re-salva** em cada pasta (recompressão/resolução diferente).
- Dedup por **nome dentro do produto** (mantendo o maior arquivo): **409 → 290**. Esse é o critério
  que reflete a realidade (`DOTY1` = a foto 1 daquele produto, independente da pasta), e foi o
  adotado. Resultado: **290 fotos reais**, em 104 produtos, na melhor resolução.

**As outras ~1.846 imagens ficaram como `sem_sku` — por falta de dado, não por falha do algoritmo.**
Três grupos:

| Grupo | Qtd | Motivo |
|---|---|---|
| Sem código no nome | ~1.038 | Importados italianos (B&B Italia, Gaetano Pesce…), fotos de ambiente e produtos que não estão em planilha nenhuma. Sem código e sem estar na planilha, não há o que casar. |
| Com código, fornecedor **sem planilha** | ~455 | Escal, Mula Preta, Leo Romano, Tissot, Aristeu Pires, Pedro Franco… O fornecedor é certo (pelo código), mas não existe planilha desses fornecedores. |
| Com código, planilha existe, produto não achado | ~391 | Gottems + MSUL (**144**) têm planilha **criptografada** (.xls com senha → 0 SKU); Sollos (177), Dona Flor (62) e outros têm produtos genuinamente **ausentes** das tabelas (descontinuados/mais novos). |

Conclusão: **melhorar o algoritmo não move mais o ponteiro.** O que limita a cobertura é dado que
falta (planilhas criptografadas, fornecedores sem planilha, produtos fora das tabelas, imagens sem
código). Por isso só as **290 confirmadas com SKU** subiram para o S3.

---

## 7. Bugs encontrados e corrigidos

| # | Bug | Efeito | Correção |
|---|---|---|---|
| 1 | `CURRENT_TABLE_KEYWORD = "atual"` — `"atual"` não é substring de `"atuais"` | 0 SKUs extraídos | Mudou para `"atuai"` |
| 2 | MIME do `.xlsm` em maiúscula (`macroEnabled.12`) | Planilhas `.xlsm` ignoradas | MIME em lowercase |
| 3 | Mutação do dict da API na listagem recursiva | Itens perdidos | Dicts novos explícitos |
| 4 | Scorer fuzzy `token_sort_ratio` punia diferença de tamanho | "turtle" × "POLTRONA TURTLE OUTDOOR" = 41 (reprovava) | Trocado por `WRatio`; **depois o fuzzy foi descartado** em favor de match por **contenção** (nomes da imagem ⊆ SKU) |
| 5 | SKUs-lixo (FOTO, PICTURE, COPIA, frases, dimensões `0,50 x 0,50`) entravam como produto | Falsos candidatos, ambiguidade | `is_valid_sku` filtra lixo, frases (>8 palavras), `*notas`, dimensões |
| 6 | Regex do código rígido (`^[A-Z]{2,5}$`) | `ART.`, `MOO.`, `BTZk`, `MOROSO` viravam "sem código" | Tolera ponto final, minúsculas e até 6 letras |
| 7 | Ambiguidade inflada por SKU duplicado | 1.445 "ambíguos" | Dedup de SKUs + classificação fornecedor/sku *(resolvido de vez pela contenção + código)* |
| 8 | `find_sku_column` só olhava 10 linhas | Dona Flor (cabeçalho na linha 13) extraía coluna errada (21 SKUs lixo) | Varre 40 linhas |
| 9 | `find_sku_column` pegava o 1º cabeçalho da esquerda | Brazil Contemporaneo pegava `REF` (códigos `9464-1`) em vez de `Descrição` → 0 match | Escolha por **conteúdo** (coluna com mais nomes de verdade) |
| 10 | Regressão na Sollos: prioridade por nome pegou uma "Descrição" cheia de `•` | Sollos caiu de 323 → 52 confirmados (v007) | Escolha por conteúdo restaura a "Referência"; `produto` rebaixado p/ a Feeling usar "Modelo" e não "Descrição do Produto" |
| 11 | Filtro de aba com plural (`"condicao"` ≠ `"condicoes"`) | Aba "Condições Comerciais" lia lixo (Desconto, Frete…) | Substrings robustas (`condic`, `atualiza`, …) |
| 12 | Fornecedor pela pasta perdia linhas em pasta diferente | Roberta Banqueri (dentro da PiuMobile) e arquivos de segmento da Sollos não agregavam | `SUPPLIER_ALIASES` por nome de arquivo/caminho |
| 13 | `drive_id` não saía no relatório | Sem âncora estável p/ dedup/idempotência na Fase 2 | Coluna `drive_id` adicionada ao relatório |

---

## 8. Dificuldades (e como foram tratadas)

- **Planilhas muito heterogêneas:** cabeçalho fundo, abas por categoria/linha, cabeçalhos bilíngues
  ("DESCRIÇÃO / DESCRIPTION"), coluna de nome vs. coluna de código, seções por coleção. → escolha de
  coluna **por conteúdo** + varredura profunda + extração de coleções.
- **Mesmo nome de produto, fornecedor na pasta errada:** linhas de designer dentro de planilha de
  distribuidor (Roberta dentro da PiuMobile), fornecedor multi-arquivo (Feeling, Sollos). → **aliases**.
- **Planilhas `.xls` criptografadas** (Gottems, MSUL): 144 imagens com fornecedor certo, mas sem SKU
  legível. → pendente (depende de liberar/descriptografar).
- **Imagem duplicada em várias pastas do Drive** (mesmo nome, bytes diferentes por re-save): inflava
  a contagem. → dedup **por nome dentro do produto, mantendo a maior resolução** (md5 não resolvia
  porque as cópias não são idênticas).
- **Insegurança operacional (1º upload):** mitigada com `--dry-run` (ensaio sem custo), upload
  idempotente e manifesto auditável.

---

## 9. Configuração do S3 e segurança

- **Bucket:** `galpao-design-imagens` (região `us-east-1`).
- **Estrutura:** `s3://galpao-design-imagens/<fornecedor-slug>/<sku-slug>/<seq>.<ext>`.
- **Acesso:** política `PublicRead` (`s3:GetObject` para `Principal: "*"`) + "Block Public Access"
  desligado → **leitura pública** das imagens, **de propósito**, para servir o catálogo.
  - É **somente leitura de objeto**: o público **não** lista o bucket nem escreve/apaga
    (escrita só com a credencial IAM `galpao-design-s3-app`).
  - As chaves S3 são previsíveis (derivadas dos nomes) e, ao exibir no site, as URLs ficam públicas
    de qualquer forma — então **não tratar a URL como segredo**. Para fotos de produto isso é o
    esperado e adequado. Conteúdo sensível **não** deve ir num bucket assim (usar privado + URLs
    assinadas).
- **Credenciais** ficam só no `.env` (no `.gitignore`); o secret da AWS aparece **uma única vez** na
  criação da chave de acesso IAM.

---

## 10. Como rodar

```bash
pip install -r requirements.txt

# Fase 1 — matching + relatório versionado (gera _vNNN e _LATEST, com drive_id)
python phase1_match.py

# Diagnóstico opcional — colisões de nome de SKU entre fornecedores
python check_sku_collisions.py

# Fase 2 — SIMULAÇÃO (mede tamanho/custo, não sobe nada, não acessa AWS)
python phase2_upload.py --dry-run

# Fase 2 — upload real (idempotente) + grava manifesto_s3.csv
python phase2_upload.py
```

`.env` necessário:

```
GOOGLE_CREDENTIALS_PATH=credentials.json
DRIVE_SPREADSHEETS_FOLDER_ID=...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=galpao-design-imagens
```
