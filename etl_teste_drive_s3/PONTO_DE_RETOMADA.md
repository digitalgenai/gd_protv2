# Ponto de Retomada — ETL Galpão Design

**Última atualização:** 2026-06-05
**Relatório mais recente:** `relatorio_analise_v003.xlsx` (e `_LATEST`)

---

## Onde paramos

Acabamos de rodar a **v003** com melhorias no fuzzy match. O matching está em bom
estado; o gargalo agora migrou de "não acha fornecedor/SKU" para **desambiguação**
(muitos candidatos parecidos). Próximo foco: reduzir ambiguidade. Nada subiu para o
S3 ainda — decisão mantida de só subir com cobertura satisfatória.

---

## O que foi feito (nesta rodada de trabalho)

### 1. Mapeamento dos fornecedores (config.py)
- Os 62 códigos foram preenchidos no `SUPPLIER_CODE_MAP` a partir da revisão da
  aba "Legenda Códigos".
- 5 códigos marcados como **`__EXCLUIR__`** (ARG, BEL, BTZE, PUS, RES) + conjunto
  `EXCLUDED_CODES`. Essas imagens são descartadas (não vão para o S3).

### 2. Fallback para fornecedor mapeado sem planilha (phase1_match.py)
- Antes: código mapeado mas sem planilha no Drive → caía em "sem match".
- Agora: usa o fornecedor do mapa de códigos (método **`mapeado`**), agrupando a
  imagem pelo código mesmo sem SKU para casar.
- Exclusão tratada (método `excluido`); novas cores e métricas no relatório
  ("mapeado (sem planilha)", "excluídas"); Legenda mostra "Excluir/Excluído".
- Corrigido bug latente do delta entre versões (comparava por chave curta em vez
  da label) — a comparação v→v agora funciona.

### 3. Melhorias no fuzzy match (phase1_match.py)
- **Scorer trocado** de `token_sort_ratio` para **`WRatio`** (resolve nomes curtos
  vs. SKUs com palavras extras: "turtle" × "POLTRONA TURTLE OUTDOOR" foi de 41→90).
- **Lista de SKUs mais limpa**: `normalize` remove `(parênteses)`, quebra barras e
  colapsa quebras de linha; `is_valid_sku` descarta cabeçalho/decoração
  (FOTO, PICTURE, COPIA, MODELO, etc.).
- **Regex de código mais tolerante** no `parse_image_name`: recupera códigos com
  ponto final (ART., MOO.), minúsculas (BTZk) e até 6 letras (MOROSO); remove
  sufixo de variante ("Turtle T04" → "Turtle") sem quebrar modelos como "UP50".

---

## Resultado: v003 vs v002

| Métrica | v002 | v003 | Δ |
|---|---|---|---|
| Total imagens | 2254 | 2257 | — |
| Mapeam. direto (c/ SKU) | 593 | 603 | +10 |
| Mapeado (sem planilha) | 583 | 591 | +8 |
| Confiança **Alta** | 7 | **424** | +417 |
| Confiança Baixa | 584 | 317 | −267 |
| **Sem match** | 974 | **373** | **−601** |
| Ambíguos | 1312 | 1445 | +133 |
| Para Revisão (aba) | 683 | 1230 | +547 |

Destaques por fornecedor (sem_match): PiuMobile 328→81, Sollos 225→119,
Casa de Pedra 75→4, Dona Flor 62→0, Feeling 213→143, Brazil Contemp. 71→26.

**Leitura:** muito menos imagens órfãs e muito mais alta confiança; o custo foi
mais casos de desambiguação (esperado com scorer mais permissivo).

---

## Próximos passos (em ordem de prioridade)

1. **Reduzir ambiguidade (1445 casos).** Investigar quanto é "falso ambíguo"
   (mesmo produto repetido na planilha) vs. ambiguidade real. Alavancas:
   - aumentar `AMBIGUITY_GAP` (hoje 5) para não marcar quando o líder está folgado;
   - **deduplicar SKUs** idênticos por fornecedor antes do matching;
   - **restringir candidatos pela pasta do Drive** (categoria) antes do fuzzy.

2. **Calibrar limiares** medindo o delta: `SIMILARITY_THRESHOLD` (70) e o efeito do
   `WRatio` na faixa Média/Baixa.

3. **Planilhas bloqueadas (Gottems, MSUL).** Acesso ainda **não liberado**. Quando
   liberar: descriptografar `.xls` → `.xlsx` e desbloquear o match por SKU desses
   fornecedores (hoje agrupam por código, sem SKU).

4. **Subir para o S3** — só quando a cobertura/ambiguidade estiver satisfatória.
   Estrutura: `s3://bucket/fornecedor/sku/imagem.jpg`. Preencher credenciais AWS
   no `.env` antes. Imagens sem SKU ficam como `SEM_SKU` no caminho.

---

## Notas de ambiente / operação

- Rodar `python phase1_match.py` gera a próxima versão (`v004`) + `_LATEST`,
  com delta colorido vs. a anterior no "Resumo da Versão".
- O mount do shell ficou com metadados defasados durante a sessão; o conteúdo real
  dos arquivos está íntegro (validado em cópia sandbox).
- Arquivo de agrupamento por fornecedor (`relatorio_agrupado.xlsx`) foi um
  experimento intermediário e não está mais na pasta — o agrupamento por
  fornecedor já vem do próprio relatório (aba "Resumo por Fornecedor").
