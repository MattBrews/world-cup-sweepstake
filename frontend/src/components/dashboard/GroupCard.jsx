import Card, { Badge } from '../ui/Card';
import ParticipantBadge from './ParticipantBadge';

const tokenColors = [
  'var(--token-1)', 'var(--token-2)', 'var(--token-3)',
  'var(--token-4)', 'var(--token-5)', 'var(--token-6)',
  'var(--token-7)', 'var(--token-8)', 'var(--token-9)',
];

export default function GroupCard({ groupLetter, standings, participants, teamMap, tokenIndex }) {
  const color = tokenColors[tokenIndex % tokenColors.length];
  const totalTeams = standings.length;
  const claimedCount = standings.filter(s => participants.some(p => p.team_id === s.team_id)).length;

  const header = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Badge number={groupLetter} color={color} />
        <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
          Group {groupLetter}
        </span>
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>
        {claimedCount}/{totalTeams}
      </span>
    </>
  );

  return (
    <Card tokenIndex={tokenIndex} header={header}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr 32px 32px 32px 32px',
          gap: 4,
          padding: '6px 16px',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <span>#</span>
          <span>Team</span>
          <span style={{ textAlign: 'center' }}>P</span>
          <span style={{ textAlign: 'center' }}>W</span>
          <span style={{ textAlign: 'center' }}>D</span>
          <span style={{ textAlign: 'center' }}>L</span>
        </div>

        {standings.map((row, i) => {
          const team = teamMap[row.team_id];
          const participant = participants.find(p => p.team_id === row.team_id);
          const bgColor = i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent';

          return (
            <div
              key={row.id || i}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px 1fr 32px 32px 32px 32px',
                gap: 4,
                padding: '7px 16px',
                fontSize: 13,
                background: bgColor,
                alignItems: 'center',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 12 }}>
                {row.rank}
              </span>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                overflow: 'hidden',
              }}>
                {team?.logo_url && (
                  <img src={team.logo_url} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
                )}
                <span style={{
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {team?.name || `Team #${row.team_id}`}
                  {participant && <ParticipantBadge name={participant.name} color={color} />}
                </span>
              </div>
              <span style={{ textAlign: 'center', fontWeight: 600 }}>{row.played}</span>
              <span style={{ textAlign: 'center', color: row.win > 0 ? 'var(--token-7)' : undefined }}>{row.win}</span>
              <span style={{ textAlign: 'center' }}>{row.draw}</span>
              <span style={{ textAlign: 'center', color: row.lose > 0 ? 'var(--token-1)' : undefined }}>{row.lose}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
