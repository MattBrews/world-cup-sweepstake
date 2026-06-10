import { useState, useEffect } from 'react';

const STAGES = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];

export default function StageNav({ current, activeStage, onSelect }) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 600);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 600);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (isMobile) {
    return (
      <select
        value={activeStage || current}
        onChange={e => onSelect?.(e.target.value)}
        style={{
          width: '100%',
          padding: '10px 14px',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(255,255,255,0.04)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          outline: 'none',
        }}
      >
        {STAGES.map(stage => (
          <option key={stage} value={stage} style={{ background: '#0b111e' }}>
            {stage}
          </option>
        ))}
      </select>
    );
  }

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
              flex: 1,
              padding: '8px 8px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              background: isActive
                ? 'var(--gradient-accent)'
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
