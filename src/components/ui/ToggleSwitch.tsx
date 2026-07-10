interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  onLabel?: string;
  offLabel?: string;
  badgeLabel?: string;
  ariaLabel?: string;
}

export default function ToggleSwitch({
  checked, onChange, onLabel = 'Sim', offLabel = 'Não', badgeLabel, ariaLabel,
}: ToggleSwitchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel}
        className="toggle-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-switch-thumb" />
      </button>
      <span style={{ fontSize: 14, fontWeight: 600, color: checked ? 'var(--gold)' : 'var(--text-secondary)' }}>
        {checked ? onLabel : offLabel}
      </span>
      {badgeLabel && checked && <span className="badge badge-gold">{badgeLabel}</span>}
    </div>
  );
}
