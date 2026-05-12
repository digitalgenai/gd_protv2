# Documento de Requisitos de Software
## Galpão Design — Sistema de Catálogo e Propostas Comerciais

> **Versão:** 2.0
> **Data:** 2026-05-30
 **Autor:** Brena Saraiva e Ranyer Lopes.
 **Gerado a partir de análise técnica do sistema existente e requisitos funcionais pré-existentes.**

## 1. Introdução
### 1.1 Propósito do Documento
Este documento tem como objetivo definir os requisitos de software para o sistema de catálogo e propostas comerciais do Galpão Design. Ele servirá como guia para a equipe de desenvolvimento, garantindo que todas as funcionalidades necessárias sejam implementadas de acordo com as expectativas dos usuários e stakeholders. Em comparação com a versão anterior, foram definidos requisitos funcionais e não-funcionais que seriam prioridade para a primeira versão do sistema.

#### 1.2 Stack Principal
| Camada | Tecnologia |
|--------|------------|
| Linguagem | Python 3.14 |
| Framework Web | Flask |
| ORM / Banco | SQLAlchemy + PostgreSQL |
| IA / LLM | OpenAI GPT-4o-mini |
| Integração Cloud | Google Drive API | Amazon S3 |
| Geração de Documentos | wkhtmltopdf, Chromium headless, XlsxWriter, Jinja2 |
| Processamento de Dados | Pandas, OpenPyXL, PDFPlumber, Pillow |
| Containerização | Docker + Docker Compose |

### 1.3 Escopo
A versão inicial do sistema cobre:
- Importação automática de planilhas de fornecedores via Google Drive 
- Geração de propostas comerciais em PDF 
- Gestão de usuários e controle de acesso por perfil (back-end)

Versões futuras irão abranger:
- Consulta e gestão do catálogo de produtos 
- Upload de imagens de produtos

### 1.4 Público-alvo deste documento
| Perfil | Interesse |
|--------|-----------|
| Proprietário / Gestor | Validar se o sistema atende ao negócio |
| Desenvolvedor | Entender o que deve ser implementado |
| Vendedor | Entender o que o sistema faz por ele |
| Fornecedor | Entender como disponibilizar planilhas na pasta compartilhada do Google Drive |

### 1.5 Definições e Termos
| Termo | Significado |
|-------|-------------|
| Proposta | Documento enviado ao cliente com lista de produtos, preços e condições |
| Fornecedor | Empresa que fabrica os móveis e envia planilhas de catálogo |
| Ingestão | Processo de importar dados de planilhas para o banco de dados |
| Acabamento | Material ou revestimento do produto (ex: Linho Bege, Couro Preto) |
| Worker | Processo automático que roda em segundo plano |
| API | Interface que permite ao frontend se comunicar com o sistema |

## 2. Visão Geral do Sistema
### 2.1 Contexto
A Galpão Design trabalha com múltiplos fornecedores de móveis. Cada fornecedor envia planilhas Excel com seus catálogos. Hoje esse processo é manual e propenso a erros. O sistema automatiza a coleta, organização e apresentação desses dados, além de permitir a criação de propostas profissionais para clientes e arquitetos.

### 2.2 Principais Usuários
| Perfil | Quem é | O que faz no sistema |
|---|---|---|
| Administrador | Gestor da Galpão Design | Gerencia usuários, monitora erros, acessa tudo |
| Supervisor | Coordenador comercial | Acompanha propostas, acessa dados agregados |
| Vendedor | Consultor de vendas | Cria e envia propostas para clientes |
| Sistema (Worker) | Processo automático | Importa planilhas do Google Drive |

### 2.3 Fluxo Resumido
**Ingestão de catálogo:**
```
Fornecedor disponibiliza planilha na pasta compartilhada do Google Drive
        ↓
Sistema importa automaticamente a cada 2 dias
        ↓
Produtos ficam disponíveis no catálogo
```

**Criação de proposta:**
```
Vendedor grava no Whisper durante o atendimento
(identifica vendedor, arquiteto, cliente e códigos dos produtos)
        ↓
Whisper → Framework de conversão de áudio para texto → Webhook automático para o sistema
        ↓
OpenAI extrai JSON estruturado da transcrição
        ↓
Sistema valida códigos contra o catálogo e salva rascunho
        ↓
Vendedor abre o sistema, revisa e corrige o rascunho
        ↓
Sistema gera proposta em PDF 
        ↓
Vendedor envia proposta ao cliente
```

## 3. Requisitos Funcionais
### 3.1 Ingestão de Catálogo
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-001 | O sistema deve monitorar automaticamente uma pasta no Google Drive e importar arquivos XLSX novos ou modificados | Alta | 
| RF-002 | O sistema deve verificar arquivos a cada 2 dias (intervalo configurável) | Alta |
| RF-003 | O sistema deve detectar arquivos alterados por checksum (MD5), evitando reprocessamento desnecessário | Alta |
| RF-004 | O sistema deve organizar os fornecedores por subpastas dentro da pasta principal no Drive | Alta |
| RF-005 | O sistema deve usar inteligência artificial para identificar automaticamente as colunas das planilhas (código, nome, preço, dimensões, etc.) | Alta |
| RF-006 | O sistema deve normalizar dimensões em formato padrão (ex: "200x100x75") independente de como estão escritas na planilha | Média |
| RF-007 | O sistema deve suportar múltiplas abas por planilha, processando cada uma separadamente | Alta |
| RF-008 | O sistema deve desativar produtos cujos arquivos foram removidos do Google Drive |Alta |
| RF-009 | O sistema deve registrar erros de importação por linha, sem interromper o processamento das demais | Alta |
| RF-010 | O sistema deve deduplicar produtos com mesma combinação de código, categoria, acabamento, medidas e preço | Média |
| RF-011 | O sistema deve permitir disparar manualmente uma sincronização com o Drive via API | Baixa |
---

### 3.2 Catálogo de Produtos
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-012 | O sistema deve listar todos os produtos ativos | Alta |
| RF-013 | O sistema deve permitir busca textual por nome ou código do produto | Alta |
| RF-014 | O sistema deve permitir filtro por categoria, acabamento e faixa de preço | Média |
| RF-015 | O sistema deve listar os valores disponíveis para cada filtro (categorias, acabamentos, fornecedores) | Alta |
| RF-016 | O sistema deve listar produtos desativados separadamente | Média |
| RF-017 | O sistema deve permitir criar produtos manualmente via API, sem depender de planilha | Baixa |
| RF-018 | O sistema deve indicar de qual arquivo/fornecedor cada produto foi importado | Baixa |
---

### 3.3 Imagens de Produtos
> As imagens são armazenadas no **Amazon S3**. O servidor Flask não persiste arquivos de imagem localmente. O `storage_path` no banco de dados contém a URL pública completa do S3. Caso necessário, verificar MAPEAMENTO_S3.md.

#### Fluxo de upload
```
Usuário envia imagem via POST /produtos/<codigo>/imagens
        ↓
Flask valida formato (JPEG / PNG / WEBP)
        ↓
Flask valida tamanho (50 KB – 10 MB)
        ↓
Flask valida resolução mínima (600×600 px) via Pillow
        ↓
Flask valida qualidade visual (fora de foco) via Pillow
        ↓
[se inválida] → retorna erro 400 ao cliente, nada é gravado
        ↓
[se válida] → utils/s3_storage.upload_image()
              envia bytes para S3: <bucket>/<prefix>/<codigo>/<arquivo>
        ↓
[se S3 falhar] → retorna erro 500, nada é gravado no banco
        ↓
[se S3 ok] → grava registro em produtos_imagens
             storage_path = URL pública do S3
        ↓
Retorna URL pública ao cliente
```
#### Fluxo de exclusão
```
Usuário envia DELETE /produtos/<codigo>/imagens/<image_id>
        ↓
Flask busca registro em produtos_imagens
        ↓
utils/s3_storage.delete_image(storage_path)
remove objeto do S3
        ↓
Remove registro do banco
        ↓
Reordena posições restantes (1, 2, 3 sem lacunas)
```
#### Fluxo de leitura
```
Cliente (front-end, PDF, XLSX) acessa a URL pública do S3 diretamente
sem passar pelo servidor Flask
URL formato: https://<bucket>.s3.<region>.amazonaws.com/<prefix>/<codigo>/<arquivo>
```
#### Recursos utilizados
| Recurso | Papel |
|---------|-------|
| Flask (`app.py`) | Recebe upload, executa validações, orquestra S3 e banco |
| Pillow | Valida resolução e qualidade visual da imagem |
| `utils/s3_storage.py` | Encapsula toda interação com o S3 (`upload_image`, `delete_image`) |
| Amazon S3 | Armazenamento e entrega pública dos arquivos de imagem |
| Tabela `produtos_imagens` | Registra `storage_path` (URL S3), `posicao` e metadados |

#### Principais erros e tratamento
| Erro | Causa | Tratamento |
|------|-------|------------|
| Format o inválido | Arquivo não é JPEG, PNG ou WEBP | Retorna 400 antes de qualquer operação |
| Tamanho forado limite | Abaixo de 50 KB ou acima de 10 MB | Retorna 400 antes de qualquer operação |
| Resolução insuficiente | Menor que 600×600 px | Retorna 400 antes de qualquer operação |
| Imagem fora de foco | Qualidade visual reprovada pelo Pillow | Retorna 400 antes de qualquer operação |
| Falha no upload S3 | Credenciais inválidas, bucket inacessível, timeout | Retorna 500; nada é gravado no banco |
| Produto já com 3 imagens | Limite por produto atingido (RN-004) | Retorna 400 informando o limite |
| Falha na exclusão S3 | Objeto já removido ou erro de permissão | Registra falha em log; remove o registro do banco mesmo assim |
---


| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-019 | O sistema deve permitir upload de até 3 imagens por produto | Alta |
| RF-020 | O sistema deve aceitar imagens nos formatos JPEG, PNG e WEBP | Alta |
| RF-021 | O sistema deve rejeitar imagens com resolução abaixo de 600×600 pixels | Média |
| RF-022 | O sistema deve rejeitar imagens com tamanho de arquivo abaixo de 50 KB ou acima de 10 MB | Média |
| RF-023 | O sistema deve rejeitar imagens com qualidade visual insuficiente (fora de foco) | Média |
| RF-024 | O sistema deve fazer upload das imagens diretamente para o Amazon S3 e armazenar a URL pública resultante no banco de dados | Alta |
| RF-025 | O sistema deve servir imagens publicamente pela URL do Amazon S3, sem intermediação do servidor Flask | Alta |
| RF-026 | O sistema deve permitir excluir imagens individualmente, removendo o objeto do Amazon S3 e o registro do banco de dados | Alta |
| RF-027 | Ao excluir uma imagem, o sistema deve reordenar automaticamente as posições restantes | Baixa |
---


### 3.4 Propostas Comerciais
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-028 | O sistema deve permitir criar uma proposta com um ou mais produtos selecionados | Alta |
| RF-029 | O sistema deve registrar os dados do cliente na proposta: nome, telefone, endereço | Alta |
| RF-030 | O sistema deve registrar o nome do arquiteto responsável na proposta | Alta |
| RF-031 | O sistema deve permitir definir quantidade e desconto percentual por item e/ou no valor total| Alta |
| RF-032 | O sistema deve calcular automaticamente o valor total de cada item e da proposta | Alta |
| RF-033 | O sistema deve gerar a proposta em formato PDF | Alta |
| RF-034 | O sistema deve gerar a proposta em formato Excel (XLSX) (Opcional) | Média |
| RF-035 | O sistema deve permitir gerar nos dois formatos simultaneamente | Média |
| RF-036 | O sistema deve incluir as imagens dos produtos na proposta | Alta |
| RF-037 | O sistema deve gerar um código único por proposta no formato: GD-MM.AA.CódVendedor.Sequência.vN.NomeCliente | Alta |
| RF-038 | O sistema deve versionar propostas, permitindo criar v1, v2, v3 da mesma proposta | Média |
| RF-039 | O sistema deve manter a sequência de propostas por mês e por vendedor (ou vendedores, em caso de venda conjunta) | Alta |
| RF-040 | O sistema deve salvar o PDF e XLSX gerados para download posterior | Alta |
| RF-041 | O sistema deve incluir logo, nome da empresa, telefone e e-mail na proposta | Média |
| RF-042 | O sistema deve permitir adicionar observações gerais à proposta | Média |
---

### 3.5 Usuários e Acesso
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-043 | O sistema deve suportar três perfis de acesso: Administrador, Supervisor e Vendedor | Alta |
| RF-044 | O sistema deve permitir cadastro de usuários com e-mail e senha | Alta |
| RF-045 | O sistema deve armazenar senhas de forma segura (hash bcrypt) | Alta |
| RF-046 | O sistema deve atribuir automaticamente um código de 3 dígitos a cada vendedor | Média |
| RF-047 | O sistema deve permitir ativar e desativar usuários | Média |
| RF-048 | Apenas Administradores devem poder gerenciar usuários | Alta |
| RF-049 | Vendedores devem visualizar e gerenciar apenas suas próprias propostas | Alta |
| RF-050 | Supervisores devem poder visualizar propostas de todos os vendedores | Alta |
---

### 3.6 Monitoramento e Operação
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-051 | O sistema deve expor um endpoint de verificação de saúde (health check) | Alta |
| RF-052 | O sistema deve exibir estatísticas gerais: total de produtos ativos, desativados, erros e imagens | Média |
| RF-053 | O sistema deve listar os arquivos importados e seus metadados | Média |
| RF-054 | O sistema deve listar os erros de importação com detalhes (arquivo, aba, linha, mensagem) | Média |
---

## 4. Requisitos Não Funcionais
> Descrevem **como** o sistema deve se comportar, não o que ele faz.
| ID | Requisito | 
|----|-----------|
| RNF-001 | A listagem de produtos deve responder em menos de 2 segundos para até 10.000 produtos |
| RNF-002 | A geração de PDF deve ser concluída em menos de 15 segundos |
| RNF-003 | A sincronização com o Drive deve processar uma planilha de 500 linhas em menos de 60 segundos |

### 4.2 Segurança
| ID | Requisito |
|----|-----------|
| RNF-004 | Todos os endpoints da API devem exigir autenticação (exceto health check) |
| RNF-005 | Senhas devem ser armazenadas com hash bcrypt, nunca em texto puro |
| RNF-006 | Uploads de arquivo devem ser validados quanto a tipo, tamanho e conteúdo |
| RNF-007 | O sistema não deve expor caminhos internos do servidor nas respostas da API |

### 4.3 Disponibilidade
| ID | Requisito |
|----|-----------|
| RNF-008 | O sistema deve estar disponível de forma contínua |
| RNF-009 | O worker de ingestão deve se recuperar automaticamente de falhas sem intervenção manual |

### 4.4 Manutenibilidade
| ID | Requisito |
|----|-----------|
| RNF-010 | Alterações no esquema do banco de dados devem ser feitas via migrations versionadas |
| RNF-011 | As configurações sensíveis (senhas, chaves de API, credenciais AWS) devem estar em variáveis de ambiente, nunca no código |
| RNF-012 | As credenciais AWS devem usar uma IAM Role com permissões mínimas: `s3:PutObject`, `s3:DeleteObject` e `s3:GetObject` restritas ao bucket de imagens |

### 4.5 Usabilidade da API
| ID | Requisito |
|----|-----------|
| RNF-013 | A API deve seguir o padrão REST com respostas em JSON |
| RNF-014 | Erros devem retornar códigos HTTP apropriados (400, 401, 404, 500) com mensagem descritiva |
| RNF-015 | Endpoints de listagem devem suportar paginação |
---

## 5. Criação de Proposta por Voz (Whisper - OpenAI)
> O vendedor utiliza uma aplicação no celualr ou tablet, via PWA, para gravar a identificação das partes e os produtos durante o atendimento. Ao finalizar, o Whisper envia a transcrição automaticamente ao framework de conversão, que dispara um webhook para o framework de validação entre o .JSON extraído e o catálogo. O vendedor, após o atendimento, abre o sistema e revisa os rascunhos pendentes antes de confirmar a proposta.

```
Vendedor grava no PWA
"Vendedor João, arquiteto Pedro, cliente Felipe.
 Produto COD-001 quantidade 2, COD-005 quantidade 1 desconto 10%"
        ↓
Whisper → Framework (automático ao finalizar a gravação)
        ↓
Framework dispara webhook → POST /webhook/proposta-voz
(endpoint público autenticado por token fixo no header X-Webhook-Token)
        ↓
Flask chama OpenAI → extrai JSON estruturado:
{ vendedor, arquiteto, cliente, itens: [{ codigo, quantidade, desconto }] }
        ↓
Sistema valida cada código contra o catálogo ativo no banco
        ↓
Rascunho salvo com status "aguardando_revisao"
        ↓
Vendedor abre o sistema, acessa rascunhos pendentes
        ↓
Revisa, corrige itens com problema e confirma
        ↓
Proposta criada normalmente 
```

#### Recursos utilizados
| Recurso | Papel |
|---------|-------|
| Whisper-1| Modelo de inteligência artificial de reconhecimento automático de fala |
| OpenAI GPT-4o-mini | Extrai JSON estruturado a partir do texto transcrito |
| Tabela `produtos` | Validação dos códigos extraídos contra o catálogo ativo |
| Tabela `users` | Resolução do nome do vendedor para um registro existente |
| Tabela `proposta_rascunhos` (nova) | Persistência do rascunho entre o webhook e a revisão do vendedor |
| Lógica de proposta existente | Criação da proposta após confirmação do rascunho |

#### Principais erros e tratamento
| Erro | Causa | Tratamento |
|------|-------|------------|
| Código de produto não encontrado | Código inexistente no catálogo ou mal transcrito pelo Whisper | Item marcado como "não encontrado" na revisão; vendedor corrige manualmente |
| Vendedor não identificado | Nome na transcrição não corresponde a nenhum usuário | Rascunho criado sem vínculo de vendedor; vendedor seleciona na tela de revisão |
| OpenAI falha ao extrair campo | Transcrição confusa ou incompleta | Campo retorna `null`; vendedor preenche na revisão |
| Transcrição vazia ou ilegível | Falha no Whisper ou gravação muito curta | Webhook rejeitado com erro 400 antes de chamar a OpenAI |
| Token do webhook inválido | Requisição não veio do framework autorizado | Endpoint retorna 401 sem processar nada |
| Rascunho expirado | Vendedor não revisou dentro de 48 horas | Rascunho descartado automaticamente; vendedor precisa regravar |

#### Requisitos Funcionais
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-055 | O sistema deve expor um endpoint de webhook para receber transcrições enviadas automaticamente | Alta |
| RF-056 | O endpoint de webhook deve ser autenticado por token fixo no header `X-Webhook-Token`, sem exigir JWT | Alta |
| RF-057 | O sistema deve usar a OpenAI para extrair da transcrição os dados: vendedor, arquiteto, cliente e lista de itens (código, quantidade, desconto) | Alta |
| RF-058 | O sistema deve validar cada código extraído contra o catálogo ativo e salvar o rascunho no banco com status `aguardando_revisao` | Alta |
| RF-059 | O sistema deve listar os rascunhos pendentes para o vendedor ao acessar o sistema | Alta |
| RF-060 | O sistema deve permitir que o vendedor corrija campos ausentes ou itens não encontrados diretamente na tela de revisão | Alta |
| RF-061 | O sistema deve converter o rascunho confirmado em proposta, seguindo o fluxo padrão de criação | Alta |
| RF-062 | O sistema deve descartar automaticamente rascunhos não confirmados após 48 horas | Baixa |
---

## 5. Regras de Negócio
| ID | Regra |
|----|-------|
| RN-001 | O código de proposta segue o formato: `GD-MM.AA.CódVendedor.Sequência.vN.NomeCliente` |
| RN-002 | A sequência de propostas é armazenada de forma legado em um Data Warehouse dentro do PostgresSQL |
| RN-003 | O código do vendedor é um número de 2 dígitos atribuído automaticamente na ordem de cadastro |
| RN-004 | Um produto pode ter no máximo 3 imagens cadastradas, armazenadas no Amazon S3 |
| RN-005 | Produtos removidos do Google Drive são desativados, não excluídos permanentemente |
| RN-006 | O valor do item na proposta é calculado como: `quantidade × preço_unitário × (1 - desconto%)` |
| RN-007 | Imagens de produtos devem ter resolução mínima de 600×600 pixels |
| RN-008 | Arquivos XLSX são reprocessados apenas quando o MD5 muda, evitando trabalho desnecessário |
| RN-009 | A identificação de produtos na transcrição de voz é feita exclusivamente por código; descrições textuais não são interpretadas como produto |
| RN-010 | Rascunhos de proposta gerados via webhook ficam disponíveis para revisão por 48 horas; após esse prazo são descartados automaticamente |
| RN-011 | O rascunho gerado via webhook só pode ser confirmado pelo vendedor identificado na transcrição; se o vendedor não for identificado, o vínculo é feito manualmente na tela de revisão |
---

## 6. Restrições Técnicas
| ID | Restrição |
|----|-----------|
| RT-001 | O sistema deve rodar em ambiente Docker (Linux) |
| RT-002 | O banco de dados utilizado é PostgreSQL |
| RT-003 | A integração com fornecedores é feita exclusivamente via Google Drive |
| RT-004 | A geração de propostas depende de Chromium ou wkhtmltopdf instalados no servidor |
| RT-005 | A inferência de cabeçalhos de planilhas utiliza a API da OpenAI (custo por uso) |
| RT-006 | O armazenamento de imagens de produtos é feito exclusivamente no Amazon S3; o servidor não persiste arquivos de imagem localmente |
| RT-007 | O bucket S3 deve ser configurado com leitura pública para que as URLs funcionem na geração de PDF e XLSX; alternativamente, podem ser usadas URLs pré-assinadas com TTL longo |
| RT-008 | A integração de voz depende do ASR - Automatic Speech Recognition (gravação e transcrição); falhas nessas ferramentas externas não são responsabilidade do sistema |
| RT-009 | O endpoint de webhook `/webhook/proposta-voz` deve ser acessível publicamente para receber chamadas do Zapier, autenticado exclusivamente por token fixo |
---

## 7. Banco de Dados
### 7.1 Descrição
O banco de dados é PostgreSQL 18, organizado em quatro grupos funcionais:
| Grupo | Tabelas | Responsabilidade |
|-------|---------|------------------|
| Usuários | `usuarios` | Autenticação, perfis e código de vendedor |
| Catálogo | `fornecedores`, `arquivos_drive`, `catalogo_produtos`, `produtos_imagens`, `erros_importacao`, `scheduler_control` | Ingestão via Google Drive e armazenamento de imagens no S3 |
| Rascunhos | `proposta_rascunhos`, `rascunho_itens` | Fluxo Plaud Note / Zapier até a confirmação da proposta |
| Propostas | `propostas`, `propostas_contador_mensal_vendedor`, `propostas_versoes`, `propostas_itens` | Criação, versionamento e geração de documentos |
---

### 7.2 Fluxo dos dados no banco
```
[Ingestão]
arquivos_drive (controle de checksum)
        ↓
catalogo_produtos (código único por fornecedor)
        ↓
produtos_imagens (URL pública S3, até 3 por produto)

[Rascunho via Plaud]
proposta_rascunhos (transcricao_original + dados_extraidos JSONB)
        ↓
rascunho_itens (codigo_extraido + produto_id nullable + status)
        ↓
[confirmado pelo vendedor]

[Proposta]
propostas (cabeçalho + codigo_base gerado por trigger)
        ↓
propostas_versoes (codigo_proposta completo: GD-MM.AA.CódVend.Seq.vN.Nome)
        ↓
propostas_itens (snapshot de preço, valor_total calculado pela DB)
```
---

### 7.3 Decisões de modelagem
| Decisão | Regra aplicada |
|---------|----------------|
| Unicidade de código de produto | `UNIQUE(codigo, fornecedor_id)` — dois fornecedores podem usar o mesmo código sem conflito (redudância em caso de conflito entre fornecedores) |
| Preço na proposta | `preco_unitario_snapshot` é copiado no momento da criação e nunca alterado por reimportações futuras |
| Código de vendedor | Atribuído automaticamente por sequence; `NULL` para perfis não-vendedor |
| Código de proposta | Gerado por trigger no banco: `GD-MM.AA.CódVend3d.Seq3d.vN.NomeCliente` |
| Sequência mensal | Reiniciada por mês e por vendedor via tabela `propostas_contador_mensal_vendedor` |
| Imagens | `storage_path` armazena a URL pública do S3; nenhum binário é salvo no banco |
| Rascunho expirado | Campo `expira_em = criado_em + 48h`; descarte via job externo ou filtro na query |
| Arquiteto na proposta | Campo opcional (`NULL` permitido); não bloqueia criação da proposta |
| FK produto em itens | `produto_id` é nullable em `propostas_itens` — o produto pode ser inativado sem quebrar propostas existentes |
---

### 7.4 Requisitos do banco de dados
| ID | Requisito | Prioridade |
|----|-----------|------------|
| RBD-001 | O banco deve rodar em PostgreSQL 18+ com fuso horário `America/Fortaleza` | Alta |
| RBD-002 | As extensões `pgcrypto`, `unaccent` e `citext` devem estar habilitadas | Alta |
| RBD-003 | Senhas de usuários devem ser armazenadas com `bcrypt` via `crypt()` do pgcrypto | Alta |
| RBD-004 | O código de vendedor deve ser atribuído automaticamente por trigger, sem intervenção da aplicação | Alta |
| RBD-005 | O código base da proposta (`GD-MM.AA...`) deve ser gerado por trigger no `INSERT`, garantindo atomicidade com o contador mensal | Alta |
| RBD-006 | O código completo da versão deve ser gerado por trigger no `INSERT` em `propostas_versoes` | Alta |
| RBD-007 | `valor_total` em `propostas_itens` deve ser coluna gerada (`GENERATED ALWAYS AS`) pela fórmula `qtd × preco × (1 - desconto%)` | Alta |
| RBD-008 | A unicidade de código de produto deve ser garantida por índice parcial `UNIQUE(codigo, fornecedor_id) WHERE codigo IS NOT NULL` | Alta |
| RBD-009 | A posição de imagem por produto deve ser garantida por `UNIQUE(produto_id, posicao)` | Média |
| RBD-010 | O campo `updated_at` deve ser atualizado automaticamente por trigger em todas as tabelas que o possuem | Média |
| RBD-011 | Rascunhos com `expira_em < now()` devem ser tratados como descartados nas consultas | Média |
| RBD-012 | A exclusão de um produto deve remover em cascata suas imagens, mas preservar os itens de proposta (SET NULL no `produto_id`) | Alta |
---

## 8. Fora do Escopo
Os itens abaixo **não fazem parte** deste sistema na versão atual:
- Integração com sistemas de pagamento
- Envio automático de propostas por e-mail
- Aplicativo mobile
- Portal de acesso para clientes finais
- Integração com ERP ou sistema de estoque
- Gerenciamento de pedidos após aprovação da proposta
---


