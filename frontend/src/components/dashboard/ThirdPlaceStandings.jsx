import { useState } from 'react';

const tokenColors = [
  'var(--token-1)', 'var(--token-2)', 'var(--token-3)',
  'var(--token-4)', 'var(--token-5)', 'var(--token-6)',
  'var(--token-7)', 'var(--token-8)', 'var(--token-9)',
];

export default function ThirdPlaceStandings({ thirdPlaces, participants, teamMap }) {
  const [expanded, setExpanded] = useState(false);
  if (!thirdPlaces || thirdPlaces.length === 0) return null;

  const advancing = thirdPlaces.filter(t => t.advances);
  const eliminated = thirdPlaces.filter(t => !t.advances);

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '14px 16px',
          cursor: 'pointer',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: expanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
          transition: 'border-color 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11,
            color: 'var(--color-text-muted)',
            transition: 'transform 0.2s',
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}>
            ▶
          </span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
            Best Third Places
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 500 }}>
            Top 8 advance
          </span>
        </div>
      </div>

      {expanded && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '24px 28px 1fr 32px 36px 36px',
            gap: 4,
            padding: '8px 16px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}>
            <span>#</span>
            <span style={{ textAlign: 'center' }}>Grp</span>
            <span>Team</span>
            <span style={{ textAlign: 'center' }}>Pts</span>
            <span style={{ textAlign: 'center' }}>GD</span>
            <span style={{ textAlign: 'center' }}>GF</span>
          </div>

          <div style={{ padding: '4px 0' }}>
            {advancing.map((t, i) => (
              <ThirdPlaceRow
                key={t.team_id}
                team={t}
                rank={t.thirdPlaceRank}
                teamMap={teamMap}
                participants={participants}
                advances={true}
                index={i}
              />
            ))}
            {eliminated.length > 0 && (
              <div style={{
                padding: '6px 16px',
                fontSize: 10,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                marginTop: 2,
              }}>
                Eliminated
              </div>
            )}
            {eliminated.map((t, i) => (
              <ThirdPlaceRow
                key={t.team_id}
                team={t}
                rank={t.thirdPlaceRank}
                teamMap={teamMap}
                participants={participants}
                advances={false}
                index={i}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ThirdPlaceRow({ team, rank, teamMap, participants, advances, index }) {
  const color = tokenColors[index % tokenColors.length];
  const participant = participants.find(p => p.team_id === team.team_id);

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '24px 28px 1fr 32px 36px 36px',
      gap: 4,
      padding: '7px 16px',
      fontSize: 13,
      background: advances
        ? (index % 2 === 0 ? 'rgba(34, 197, 94, 0.06)' : 'rgba(34, 197, 94, 0.03)')
        : (index % 2 === 0 ? 'rgba(239, 68, 68, 0.06)' : 'rgba(239, 68, 68, 0.03)'),
      alignItems: 'center',
      borderLeft: `3px solid ${advances ? 'var(--token-7)' : 'var(--token-1)'}`,
    }}>
      <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-text-muted)' }}>
        {rank}
      </span>
      <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 12 }}>
        {team.group_letter}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        {team.logo_url && (
          <img src={team.logo_url} alt="" style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }} />
        )}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }} title={team.team_name}>
            {team.team_name}
          </span>
          {participant && (
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }} title={participant.name}>
              {participant.name}
            </span>
          )}
        </div>
      </div>
      <span style={{ textAlign: 'center', fontWeight: 700 }}>{team.points}</span>
      <span style={{ textAlign: 'center', color: team.goal_diff > 0 ? 'var(--token-7)' : team.goal_diff < 0 ? 'var(--token-1)' : undefined }}>
        {team.goal_diff > 0 ? `+${team.goal_diff}` : team.goal_diff}
      </span>
      <span style={{ textAlign: 'center' }}>{team.goals_for}</span>
    </div>
  );
}