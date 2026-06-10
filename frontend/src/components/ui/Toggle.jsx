export default function Toggle({ options, selected, onSelect }) {
  return (
    <div style={{
      display: 'inline-flex',
      borderRadius: 8,
      background: 'rgba(255,255,255,0.04)',
      padding: 3,
      gap: 2,
    }}>
      {options.map(opt => {
        const isActive = opt.value === selected;
        return (
          <button
            key={opt.value}
            onClick={() => onSelect(opt.value)}
            style={{
              padding: '6px 16px',
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              background: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-muted)',
              transition: 'all 0.2s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
