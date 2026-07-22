import { useEffect, useState, type InputHTMLAttributes } from 'react';

function centavosParaTexto(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number;
  onChange: (value: number) => void;
}

/** Input de valor em reais com máscara "R$ 1.234,56" — digita só números, preenche da
 * direita pra esquerda (como caixa eletrônico/maquininha), sem as setinhas de
 * incremento feias do type="number" nem risco de digitar texto inválido. */
export default function CurrencyInput({ value, onChange, className, ...rest }: CurrencyInputProps) {
  const [texto, setTexto] = useState(() => centavosParaTexto(Math.round(value * 100)));

  useEffect(() => {
    setTexto(centavosParaTexto(Math.round(value * 100)));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digitos = e.target.value.replace(/\D/g, '');
    const centavos = digitos ? parseInt(digitos, 10) : 0;
    setTexto(centavosParaTexto(centavos));
    onChange(centavos / 100);
  }

  return (
    <div className="currency-input-wrap">
      <span className="currency-input-prefix">R$</span>
      <input
        type="text"
        inputMode="decimal"
        className={`currency-input ${className ?? ''}`}
        value={texto}
        onChange={handleChange}
        {...rest}
      />
    </div>
  );
}
