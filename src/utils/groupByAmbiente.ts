export const DEFAULT_AMBIENTE = 'Itens Gerais';

export interface AmbienteGroup<T> {
  ambiente: string;
  items: T[];
}

/** Agrupa itens por ambiente preservando a ordem em que cada ambiente apareceu pela primeira vez. */
export function groupByAmbiente<T extends { ambiente: string }>(items: T[]): AmbienteGroup<T>[] {
  const order: string[] = [];
  const map = new Map<string, T[]>();

  items.forEach((item) => {
    const key = item.ambiente.trim() || DEFAULT_AMBIENTE;
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(item);
  });

  return order.map((key) => ({ ambiente: key, items: map.get(key)! }));
}

/** Só vale a pena mostrar as barras de ambiente quando pelo menos um item tem ambiente definido. */
export function shouldShowAmbienteHeaders<T>(groups: AmbienteGroup<T>[]): boolean {
  return groups.length > 1 || (groups.length === 1 && groups[0].ambiente !== DEFAULT_AMBIENTE);
}

/**
 * Reordena os grupos seguindo a ordem em que os ambientes foram criados pelo consultor
 * (`ambientes`), em vez da ordem de primeira aparição nos itens. Sobras (ex.: "Itens Gerais",
 * ou ambientes de itens antigos que não constam mais na lista) vão para o final, na ordem em
 * que já estavam.
 */
export function orderGroupsByAmbientList<T>(groups: AmbienteGroup<T>[], ambientes: string[]): AmbienteGroup<T>[] {
  const byName = new Map(groups.map((g) => [g.ambiente, g] as const));
  const ordered: AmbienteGroup<T>[] = [];

  ambientes.forEach((name) => {
    const group = byName.get(name);
    if (group) {
      ordered.push(group);
      byName.delete(name);
    }
  });

  groups.forEach((g) => {
    if (byName.has(g.ambiente)) ordered.push(g);
  });

  return ordered;
}

export const AMBIENTE_SUGGESTIONS = [
  'Hall', 'Estar', 'Jantar', 'Cozinha', 'Home', 'Escritório',
  'Suíte Master', 'Varanda Suíte Master', 'Quarto', 'Varanda', 'Banheiro', 'Área Externa',
];
