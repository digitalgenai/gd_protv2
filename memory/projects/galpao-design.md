# Projeto Galpão Design

**Status:** Ativo

## Personalização dos itens da proposta

No modal **Detalhes** de um item da proposta, os seguintes campos são editáveis:

- Acabamento
- Material
- Preço
- Dimensões

Categoria e fornecedor permanecem somente leitura, pois representam a identidade do produto no catálogo.

Ao adicionar um produto, os valores iniciais vêm do catálogo. Qualquer alteração feita dentro da proposta afeta apenas aquele item e não modifica o cadastro do produto.

As personalizações devem aparecer:

- No editor da proposta
- Na prévia
- No PDF
- No texto auxiliar da miniatura do item

## Decisão temporária de persistência

As personalizações funcionam apenas no rascunho em memória. O backend atual ainda grava somente os dados já existentes do item, como código, nome, preço, quantidade e desconto.

**Não criar nem alterar colunas em `propostas_itens` agora.**

A analista de dados ainda criará e enviará o documento/modelo da estrutura necessária. Quando o documento chegar:

1. Conferir os nomes, tipos e restrições das novas colunas.
2. Atualizar o modelo e as rotas do backend.
3. Atualizar os serializers e contratos da API.
4. Conectar os campos já prontos no frontend.
5. Testar salvar, reabrir, versionar, visualizar e gerar PDF mantendo as personalizações.

## Regra de continuidade

Até receber o documento da analista, não tratar a ausência dessas colunas como bug do frontend e não fazer migração provisória no banco.
