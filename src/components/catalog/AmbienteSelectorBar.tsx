import { Home } from 'lucide-react';

interface AmbienteSelectorBarProps {
  ambientes: string[];
  selected: string;
  onChange: (value: string) => void;
  /** Descrições dos itens já adicionados ao ambiente selecionado, para dar contexto ao navegar o catálogo. */
  itemsInSelected?: string[];
}

/**
 * Barra fixa no topo do catálogo (modal ou tela cheia) indicando para qual ambiente da
 * proposta os próximos itens adicionados vão — sem ela, "+ Proposta" sempre soltava o item
 * em "Itens Gerais", obrigando reatribuição manual depois na tabela.
 */
export default function AmbienteSelectorBar({ ambientes, selected, onChange, itemsInSelected = [] }: AmbienteSelectorBarProps) {
  if (ambientes.length === 0) {
    return (
      <div
        className="flex items-center gap-2"
        style={{ fontSize: 12.5, color: 'var(--text-secondary)', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}
      >
        <Home style={{ width: 13, height: 13, flexShrink: 0 }} />
        Nenhum ambiente definido nesta proposta — os itens adicionados aqui vão para "Itens Gerais". Crie ambientes na tela da proposta para organizar por cômodo.
      </div>
    );
  }

  return (
    <div
      style={{ background: 'rgba(123,29,52,.06)', border: '1px solid rgba(123,29,52,.2)', borderRadius: 8, padding: '8px 12px', marginBottom: 14 }}
    >
      <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13 }}>
        <Home style={{ width: 13, height: 13, color: 'var(--gold)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600 }}>Adicionando itens para:</span>
        <select
          className="form-input"
          style={{ width: 'auto', fontSize: 13, padding: '4px 26px 4px 8px' }}
          aria-label="Ambiente de destino dos próximos itens adicionados"
          value={selected}
          onChange={(e) => onChange(e.target.value)}
        >
          {ambientes.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>
      {itemsInSelected.length > 0 ? (
        <div className="flex items-center gap-1.5 flex-wrap" style={{ fontSize: 12, marginTop: 8, paddingLeft: 21 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Já em "{selected}":</span>
          {itemsInSelected.map((desc, i) => (
            <span key={i} className="badge badge-gold" style={{ fontWeight: 500 }}>{desc}</span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 6, paddingLeft: 21 }}>
          Nenhum item ainda neste ambiente.
        </div>
      )}
    </div>
  );
}
