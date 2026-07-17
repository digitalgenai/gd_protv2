import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as espo from './espoClient.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dirname, '..', '.env') });

const COMMON_ENTITIES =
  'Contact, Lead, Account, Opportunity, Task, Meeting, Call, User, Document, Note (os nomes exatos dependem da configuração da instância — em caso de dúvida, use list_records com maxSize pequeno pra explorar).';

const whereClauseSchema = z.object({
  type: z
    .string()
    .describe('Tipo do filtro do EspoCRM: equals, notEquals, like, contains, isEmpty, greaterThan, in, etc.'),
  attribute: z.string().optional().describe('Campo ao qual o filtro se aplica (ex.: "status", "createdAt").'),
  value: z.unknown().optional().describe('Valor comparado pelo filtro.'),
});

const server = new McpServer({ name: 'engajacrm', version: '0.1.0' });

server.tool(
  'list_records',
  `Lista/busca registros de uma entidade do EngajaCRM (EspoCRM). Entidades comuns: ${COMMON_ENTITIES}`,
  {
    entityType: z.string().describe('Nome da entidade no EspoCRM, ex.: "Contact", "Lead", "Opportunity".'),
    textFilter: z.string().optional().describe('Busca livre por texto (nome, e-mail, etc.).'),
    where: z.array(whereClauseSchema).optional().describe('Filtros estruturados adicionais.'),
    select: z.string().optional().describe('Lista de campos separados por vírgula, pra limitar a resposta.'),
    orderBy: z.string().optional().describe('Campo de ordenação, ex.: "createdAt".'),
    order: z.enum(['asc', 'desc']).optional(),
    maxSize: z.number().int().min(1).max(200).optional().describe('Quantidade máxima de registros (padrão do EspoCRM: 20).'),
    offset: z.number().int().min(0).optional(),
  },
  async ({ entityType, ...params }) => {
    const data = await espo.listRecords(entityType, params);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'get_record',
  'Busca um registro específico do EngajaCRM pelo id.',
  {
    entityType: z.string().describe('Nome da entidade, ex.: "Contact", "Opportunity".'),
    id: z.string().describe('Id do registro no EspoCRM.'),
  },
  async ({ entityType, id }) => {
    const data = await espo.getRecord(entityType, id);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'create_record',
  'Cria um novo registro no EngajaCRM (ex.: um Lead ou Contact novo). Use com atenção — grava dados reais no CRM da empresa.',
  {
    entityType: z.string().describe('Nome da entidade a criar, ex.: "Lead", "Contact", "Opportunity".'),
    attributes: z.record(z.unknown()).describe('Campos do novo registro, ex.: { "name": "...", "emailAddress": "..." }.'),
  },
  async ({ entityType, attributes }) => {
    const data = await espo.createRecord(entityType, attributes);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'update_record',
  'Atualiza campos de um registro existente no EngajaCRM. Use com atenção — altera dados reais no CRM da empresa.',
  {
    entityType: z.string().describe('Nome da entidade, ex.: "Contact", "Opportunity".'),
    id: z.string().describe('Id do registro a atualizar.'),
    attributes: z.record(z.unknown()).describe('Campos a atualizar, ex.: { "status": "Convertido" }.'),
  },
  async ({ entityType, id, attributes }) => {
    const data = await espo.updateRecord(entityType, id, attributes);
    return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
  },
);

server.tool(
  'delete_record',
  'Move um registro do EngajaCRM pra lixeira (soft-delete — recuperável pela Administração do EspoCRM, não é uma exclusão definitiva). Use com atenção.',
  {
    entityType: z.string().describe('Nome da entidade, ex.: "Contact", "Lead".'),
    id: z.string().describe('Id do registro a remover.'),
  },
  async ({ entityType, id }) => {
    await espo.deleteRecord(entityType, id);
    return { content: [{ type: 'text', text: `Registro ${entityType}/${id} movido para a lixeira.` }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
