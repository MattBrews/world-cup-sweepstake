export default function BracketView({ fixtures, teams, participants }) {
  const rounds = ['Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];
  const roundFixtures = {};
  for (const r of rounds) {
    roundFixtures[r] = fixtures.filter(f => f.round === r).sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  return (
    <div style={{
      display: 'flex',
      gap: 12,
      overflowX: 'auto',
      paddingBottom: 8,
    }}>
      {rounds.map(round => {
        const matches = roundFixtures[round] || [];
        return (
          <div key={round} style={{ minWidth: 200, flex: 1 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
              marginBottom: 8,
              padding: '0 4px',
            }}>
              {round}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {matches.map(f => {
                const homeTeam = teams.find(t => t.id === f.home_team_id);
                const awayTeam = teams.find(t => t.id === f.away_team_id);
                const isFinished = f.status === 'FT' || f.status === 'AET' || f.status === 'PEN';

                return (
                  <div key={f.id} className="glass" style={{
                    padding: '10px 12px',
                    borderLeft: `3px solid ${isFinished ? 'var(--token-7)' : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{homeTeam?.name || '?'}</span>
                        <span style={{ fontWeight: 800 }}>{isFinished ? (f.home_score ?? '-') : '-'}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 500 }}>{awayTeam?.name || '?'}</span>
                        <span style={{ fontWeight: 800 }}>{isFinished ? (f.away_score ?? '-') : '-'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {matches.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: 8, textAlign: 'center' }}>
                  TBD
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
