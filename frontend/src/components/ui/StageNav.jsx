const STAGES = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

export default function StageNav({ current, activeStage, onSelect }) {
  const currentIdx = STAGES.indexOf(activeStage || current);

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      overflowX: 'auto',
      paddingBottom: 4,
    }}>
      {STAGES.map((stage, i) => {
        const isActive = stage === activeStage;
        const isPast = currentIdx !== -1 && i < currentIdx;
        const isCurrent = stage === current;

        return (
          <button
            key={stage}
            onClick={() => onSelect?.(stage)}
            style={{
              padding: '8px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: isActive
                ? 'var(--color-accent)'
                : isCurrent
                  ? 'rgba(255,90,121,0.15)'
                  : 'rgba(255,255,255,0.04)',
              color: isActive ? '#fff' : isCurrent ? 'var(--color-accent)' : isPast ? 'var(--color-text-muted)' : 'var(--color-text)',
              border: isActive
                ? 'none'
                : '1px solid rgba(255,255,255,0.06)',
              transition: 'all 0.2s',
              opacity: isPast ? 0.6 : 1,
            }}
          >
            {stage}
          </button>
        );
      })}
    </div>
  );
}

export { STAGES };
