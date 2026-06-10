export default function ProgressBar({ current, total, label, statusText }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="glass" style={{
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      padding: '12px 20px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 18 }}>⚽</span>
        <span style={{ color: 'var(--color-accent)', fontWeight: 600, fontSize: 14 }}>
          {statusText || 'In Progress'}
        </span>
      </div>

      <div style={{
        flex: 1,
        height: 6,
        borderRadius: 3,
        background: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
        minWidth: 80,
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 3,
          background: 'var(--gradient-accent)',
          transition: 'width 0.5s ease',
        }} />
      </div>

      <div style={{
        whiteSpace: 'nowrap',
        fontWeight: 600,
        fontSize: 14,
        color: 'var(--color-text-muted)',
      }}>
        {current}/{total}
      </div>
    </div>
  );
}
