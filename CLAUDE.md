# Memória

## Projetos ativos

| Projeto | Contexto |
|---|---|
| **Galpão Design** | Sistema React + TypeScript para catálogo e criação de propostas comerciais, com backend Flask/PostgreSQL e imagens no S3. |

## Decisões do projeto

- Preservar o design e a experiência já construídos ao incorporar referências do Figma.
- Personalizações de item — acabamento, material, preço e dimensões — pertencem à proposta e não alteram o cadastro original do produto.
- Por enquanto, essas personalizações ficam apenas no rascunho em memória.
- Não alterar o banco para persistir as personalizações até a analista de dados entregar o documento/modelo da tabela `propostas_itens`.
- Quando esse documento chegar, preparar a integração do frontend e do backend com as novas colunas.

→ Detalhes: `memory/projects/galpao-design.md`
