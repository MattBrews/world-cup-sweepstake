export default function MatchCard({ fixture, homeTeam, awayTeam, participants, teams }) {
  const homeParticipant = participants.find(p => p.team_id === fixture.home_team_id);
  const awayParticipant = participants.find(p => p.team_id === fixture.away_team_id);
  const isFinished = fixture.status === 'FT' || fixture.status === 'AET' || fixture.status === 'PEN';
  const isLive = fixture.status === '1H' || fixture.status === '2H' || fixture.status === 'HT' || fixture.status === 'ET';

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

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 20, height: 20 }} />}
          <div>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{homeTeam?.name || `Team #${fixture.home_team_id}`}</span>
            {homeParticipant && (
              <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>{homeParticipant.name}</div>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontWeight: 800,
          fontSize: 18,
          minWidth: 50,
          justifyContent: 'center',
        }}>
          {isFinished || isLive ? (
            <>
              <span style={{ color: 'var(--color-text)' }}>{fixture.home_score ?? '-'}</span>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>:</span>
              <span style={{ color: 'var(--color-text)' }}>{fixture.away_score ?? '-'}</span>
            </>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>vs</span>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'left' }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{awayTeam?.name || `Team #${fixture.away_team_id}`}</span>
            {awayParticipant && (
              <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>{awayParticipant.name}</div>
            )}
          </div>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 20, height: 20 }} />}
        </div>
      </div>
    </div>
  );
}
