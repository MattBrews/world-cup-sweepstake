export default function MatchCard({ fixture, homeTeam, awayTeam, participants, teams }) {
  const homeParticipant = participants.find(p => p.team_id === fixture.home_team_id);
  const awayParticipant = participants.find(p => p.team_id === fixture.away_team_id);
  const isFinished = fixture.status === 'FT';
  const isLive = false;

  const date = new Date(fixture.date);
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <div className="glass" style={{
      padding: '14px 16px',
      borderLeft: `3px solid ${isLive ? 'var(--color-accent)' : isFinished ? 'var(--token-7)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {isLive ? '🔴 LIVE' : `${dateStr} · ${timeStr}`}
        {fixture.round && <span style={{ marginLeft: 8 }}>{fixture.round}</span>}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{homeTeam?.name || `Team #${fixture.home_team_id}`}</span>
            <div style={{ fontSize: 10, color: homeParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{homeParticipant?.name || '\u00A0'}</div>
          </div>
        </div>

        <div style={{
          fontWeight: 800,
          fontSize: 16,
          flexShrink: 0,
        }}>
          {isFinished || isLive ? (
            <span style={{ color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
              {fixture.home_score ?? '-'}:{fixture.away_score ?? '-'}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>vs</span>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{awayTeam?.name || `Team #${fixture.away_team_id}`}</span>
            <div style={{ fontSize: 10, color: awayParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{awayParticipant?.name || '\u00A0'}</div>
          </div>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  );
}
