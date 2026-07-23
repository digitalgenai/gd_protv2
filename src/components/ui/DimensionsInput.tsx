interface DimensionParts {
  largura: string;
  profundidade: string;
  altura: string;
  diametro: string;
  unidade: string;
}

interface DimensionsInputProps {
  value: string;
  onChange: (value: string) => void;
  idPrefix?: string;
}

function parseDimensions(value: string): DimensionParts {
  const unit = value.match(/\b(mm|cm|m)\b/i)?.[1]?.toLowerCase() || 'cm';
  const read = (pattern: RegExp) => value.match(pattern)?.[1]?.replace(',', '.') || '';
  const labelled = {
    largura: read(/(?:^|[×x\s])L(?:argura)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i),
    profundidade: read(/(?:^|[×x\s])(?:P(?:\/C)?|C)(?:rofundidade|omprimento)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i),
    altura: read(/(?:^|[×x\s])A(?:ltura)?\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i),
    diametro: read(/(?:Ø|Diâmetro)\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i),
  };
  if (Object.values(labelled).some(Boolean)) return { ...labelled, unidade: unit };

  const numbers = [...value.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => match[0].replace(',', '.'));
  return {
    largura: numbers[0] || '',
    profundidade: numbers[1] || '',
    altura: numbers[2] || '',
    diametro: '',
    unidade: unit,
  };
}

function formatDimensions(parts: DimensionParts) {
  const values = [
    parts.largura && `L ${parts.largura}`,
    parts.profundidade && `P/C ${parts.profundidade}`,
    parts.altura && `A ${parts.altura}`,
    parts.diametro && `Ø ${parts.diametro}`,
  ].filter(Boolean);
  return values.length ? `${values.join(' × ')} ${parts.unidade}` : '';
}

/** Campos guiados; o banco continua recebendo uma descrição única e compatível com o legado. */
export default function DimensionsInput({ value, onChange, idPrefix = 'dimensions' }: DimensionsInputProps) {
  const parts = parseDimensions(value);

  function update(field: keyof DimensionParts, nextValue: string) {
    const cleanValue = field === 'unidade' ? nextValue : nextValue.replace(/[^\d.,]/g, '');
    onChange(formatDimensions({ ...parts, [field]: cleanValue }));
  }

  const fields: { key: keyof Pick<DimensionParts, 'largura' | 'profundidade' | 'altura' | 'diametro'>; label: string; short: string }[] = [
    { key: 'largura', label: 'Largura', short: 'L' },
    { key: 'profundidade', label: 'Profundidade / comprimento', short: 'P/C' },
    { key: 'altura', label: 'Altura', short: 'A' },
    { key: 'diametro', label: 'Diâmetro', short: 'Ø' },
  ];

  return (
    <fieldset className="dimensions-fieldset">
      <legend className="form-label">Dimensões</legend>
      <div className="dimensions-help">Preencha somente as medidas que se aplicam ao produto.</div>
      <div className="dimensions-grid">
        {fields.map((field) => (
          <label key={field.key} className="dimension-field" htmlFor={`${idPrefix}-${field.key}`}>
            <span>{field.label}</span>
            <div className="dimension-input-wrap">
              <b>{field.short}</b>
              <input
                id={`${idPrefix}-${field.key}`}
                className="form-input"
                inputMode="decimal"
                placeholder="0"
                value={parts[field.key]}
                onChange={(event) => update(field.key, event.target.value)}
              />
            </div>
          </label>
        ))}
        <label className="dimension-field" htmlFor={`${idPrefix}-unidade`}>
          <span>Unidade de medida</span>
          <select
            id={`${idPrefix}-unidade`}
            className="form-input"
            value={parts.unidade}
            onChange={(event) => update('unidade', event.target.value)}
          >
            <option value="cm">cm</option>
            <option value="m">m</option>
            <option value="mm">mm</option>
          </select>
        </label>
      </div>
      {value && (
        <div className="dimensions-preview" aria-live="polite">
          <span>Como será salvo</span>
          <strong>{value}</strong>
        </div>
      )}
    </fieldset>
  );
}
