export default function ParticipantBadge({ name, color }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      color: color || 'var(--color-accent)',
      background: `${color || 'var(--color-accent)'}1a`,
      padding: '1px 8px',
      borderRadius: 4,
      marginLeft: 6,
      whiteSpace: 'nowrap',
    }}>
      {name}
    </span>
  );
}
