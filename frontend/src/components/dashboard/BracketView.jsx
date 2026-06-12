const BRACKET_ROUNDS = [
  { key: 'Round of 32', label: 'R32', matches: 16 },
  { key: 'Round of 16', label: 'R16', matches: 8 },
  { key: 'Quarter-finals', label: 'QF', matches: 4 },
  { key: 'Semi-finals', label: 'SF', matches: 2 },
  { key: '3rd Place', label: '3rd', matches: 1 },
  { key: 'Final', label: 'Final', matches: 1 },
];

function buildRoundPositions(allFixtures) {
  const byStage = {};
  for (const f of allFixtures) {
    if (!byStage[f.stage]) byStage[f.stage] = [];
    byStage[f.stage].push(f);
  }
  const pos = {};
  for (const stage of Object.keys(byStage)) {
    const sorted = byStage[stage].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach((f, i) => { pos[f.id] = i + 1; });
  }
  return pos;
}

function shortRound(key) {
  for (const r of BRACKET_ROUNDS) if (r.key === key) return r.label;
  return key;
}

function feederLabel(label, fixtureMap, roundPositions) {
  if (!label || label === 'null') return null;
  if (typeof label !== 'string') return null;
  if (label.startsWith('W')) {
    const fid = parseInt(label.slice(1));
    const feeder = fixtureMap[fid];
    if (feeder) {
      const pos = roundPositions[fid] || '?';
      return `Winner of ${shortRound(feeder.stage)} #${pos}`;
    }
  }
  if (label.startsWith('L')) {
    const fid = parseInt(label.slice(1));
    const feeder = fixtureMap[fid];
    if (feeder) {
      const pos = roundPositions[fid] || '?';
      return `Loser of ${shortRound(feeder.stage)} #${pos}`;
    }
  }
  if (/^\d[A-Z]$/.test(label)) {
    const pos = label[0] === '1' ? 'Winner' : 'Runner-up';
    return `Group ${label[1]} ${pos}`;
  }
  const m = label.match(/^(\d)([A-Z])\/([A-Z/]+)$/);
  if (m) return `Best 3rd (${m[2]}/${m[3]})`;
  return label;
}

export default function BracketView({ fixtures, allFixtures = [], teams, participants = [], onClick }) {
  const fixtureMap = {};
  for (const f of allFixtures) fixtureMap[f.id] = f;

  const teamToParticipant = {};
  for (const p of participants) {
    teamToParticipant[p.team_id] = p.name;
  }

  const roundPositions = buildRoundPositions(allFixtures);

  const roundFixtures = {};
  for (const r of BRACKET_ROUNDS) {
    roundFixtures[r.key] = fixtures
      .filter(f => f.stage === r.key)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  }

  const getTeam = (id) => teams.find(t => t.id === id);

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      overflowX: 'auto',
      paddingBottom: 12,
      alignItems: 'flex-start',
    }}>
      {BRACKET_ROUNDS.map((round, ri) => {
        const matches = roundFixtures[round.key] || [];
        if (matches.length === 0) return null;

        const matchGap = ri === 0 ? 8
          : ri === 1 ? 24
          : ri === 2 ? 48
          : ri === 3 ? 96
          : ri >= 4 ? 160
          : 8;

        return (
          <div key={round.key} style={{ minWidth: 200, flex: 1 }}>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: 'var(--color-text-muted)',
              marginBottom: 12,
              padding: '0 4px',
              textAlign: 'center',
            }}>
              {round.label}
            </div>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: `${matchGap}px`,
            }}>
              {matches.map((f, mi) => {
                const homeTeam = getTeam(f.home_team_id);
                const awayTeam = getTeam(f.away_team_id);
                const isFinished = f.status === 'FT';
                const pos = roundPositions[f.id];
                const homeLabel = homeTeam?.name ||
                  (f.home_team_id === null ? (feederLabel(f.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
                const awayLabel = awayTeam?.name ||
                  (f.away_team_id === null ? (feederLabel(f.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');

                return (
                  <div key={f.id} style={{ position: 'relative' }}>
                    {ri > 0 && mi < (roundFixtures[BRACKET_ROUNDS[ri - 1]?.key]?.length || 0) && (
                      <div style={{
                        position: 'absolute',
                        right: '100%',
                        top: '50%',
                        width: 24,
                        height: 0,
                        borderTop: '1px solid rgba(255,255,255,0.15)',
                        marginRight: 0,
                      }} />
                    )}
                    <div
                      className="glass"
                      onClick={onClick && isFinished ? () => onClick(f.id) : undefined}
                      style={{
                        padding: '10px 12px',
                        borderLeft: `3px solid ${isFinished ? 'var(--token-7)' : 'rgba(255,255,255,0.1)'}`,
                        cursor: onClick && isFinished ? 'pointer' : undefined,
                        transition: onClick && isFinished ? 'transform 0.15s, box-shadow 0.15s' : undefined,
                      }}
                      onMouseEnter={onClick && isFinished ? e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; } : undefined}
                      onMouseLeave={onClick && isFinished ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
                    >
                      {pos && (
                        <div style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: 'rgba(255,255,255,0.25)',
                          marginBottom: 4,
                        }}>
                          #{pos}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />}
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{
                                fontWeight: homeTeam ? 600 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: homeTeam ? undefined : 'var(--color-text-muted)',
                                fontStyle: homeTeam ? undefined : 'italic',
                              }} title={homeLabel}>
                                {homeLabel}
                              </span>
                              {homeTeam && teamToParticipant[homeTeam.id] && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: 'var(--token-7)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }} title={teamToParticipant[homeTeam.id]}>
                                  {teamToParticipant[homeTeam.id]}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontWeight: 800, marginLeft: 8, flexShrink: 0 }}>
                            {isFinished ? (f.home_score ?? '-') : '-'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />}
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                              <span style={{
                                fontWeight: awayTeam ? 600 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: awayTeam ? undefined : 'var(--color-text-muted)',
                                fontStyle: awayTeam ? undefined : 'italic',
                              }} title={awayLabel}>
                                {awayLabel}
                              </span>
                              {awayTeam && teamToParticipant[awayTeam.id] && (
                                <span style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  color: 'var(--token-7)',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }} title={teamToParticipant[awayTeam.id]}>
                                  {teamToParticipant[awayTeam.id]}
                                </span>
                              )}
                            </div>
                          </div>
                          <span style={{ fontWeight: 800, marginLeft: 8, flexShrink: 0 }}>
                            {isFinished ? (f.away_score ?? '-') : '-'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
