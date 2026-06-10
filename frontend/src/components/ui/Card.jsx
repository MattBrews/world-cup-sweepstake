const tokenColors = [
  'var(--token-1)', 'var(--token-2)', 'var(--token-3)',
  'var(--token-4)', 'var(--token-5)', 'var(--token-6)',
  'var(--token-7)', 'var(--token-8)', 'var(--token-9)',
];

export default function Card({ tokenIndex = 0, header, children, style }) {
  const color = tokenColors[tokenIndex % tokenColors.length];

  return (
    <div
      className="glass"
      style={{
        borderColor: color,
        boxShadow: `0 0 20px ${color}26, inset 0 0 0 1px ${color}15`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {header && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {header}
        </div>
      )}
      <div style={{ padding: header ? '8px 0' : '16px' }}>
        {children}
      </div>
    </div>
  );
}

export function Badge({ number, color }) {
  return (
    <div style={{
      width: 28,
      height: 28,
      borderRadius: '50%',
      background: color || 'var(--token-1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      color: '#fff',
      flexShrink: 0,
    }}>
      {number}
    </div>
  );
}
