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
    const sorted = byStage[stage].sort((a, b) => a.id - b.id);
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

function buildFeederPairs(roundFixtures, fixtureMap) {
  const pairs = {};
  for (let ri = 0; ri < BRACKET_ROUNDS.length - 1; ri++) {
    const prev = BRACKET_ROUNDS[ri];
    const next = BRACKET_ROUNDS[ri + 1];
    const nextMatches = roundFixtures[next.key] || [];

    const pairMap = {};
    for (const nm of nextMatches) {
      for (const ph of [nm.home_placeholder, nm.away_placeholder]) {
        if (!ph || !(ph.startsWith('W') || ph.startsWith('L'))) continue;
        const fid = parseInt(ph.slice(1));
        const feeder = fixtureMap[fid];
        if (feeder && feeder.stage === prev.key) {
          if (!pairMap[nm.id]) pairMap[nm.id] = [];
          pairMap[nm.id].push(fid);
        }
      }
    }
    pairs[prev.key] = Object.values(pairMap)
      .filter(p => p.length === 2)
      .map(p => p.sort((a, b) => a - b))
      .sort((a, b) => a[0] - b[0]);
  }
  return pairs;
}

function MatchCardSmall({ fixture, homeTeam, awayTeam, teamToParticipant, isFinished, isLive, onClick, homeLabel, awayLabel, matchNumber }) {
  const displayHomeLabel = homeLabel || (fixture.home_team_id === null ? 'TBD' : '?');
  const displayAwayLabel = awayLabel || (fixture.away_team_id === null ? 'TBD' : '?');

  return (
    <div
      className="glass"
      onClick={onClick && (isFinished || isLive) ? () => onClick(fixture.id) : undefined}
      style={{
        padding: '8px 10px',
        borderLeft: `3px solid ${isFinished ? 'var(--token-7)' : isLive ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)'}`,
        cursor: onClick && (isFinished || isLive) ? 'pointer' : undefined,
        transition: 'transform 0.15s, box-shadow 0.15s',
        flex: 1,
        minWidth: 0,
      }}
      onMouseEnter={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; } : undefined}
      onMouseLeave={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {matchNumber && (
          <div style={{
            fontSize: 10,
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            minWidth: 20,
            textAlign: 'center',
          }}>
            #{matchNumber}
          </div>
        )}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />}
          <span style={{
            fontWeight: homeTeam ? 600 : 400,
            fontSize: 11,
            color: homeTeam ? undefined : 'var(--color-text-muted)',
            fontStyle: homeTeam ? undefined : 'italic',
            }} title={displayHomeLabel}>
            {displayHomeLabel}
          </span>
          {homeTeam && teamToParticipant[homeTeam.id] && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--token-7)',
            }} title={teamToParticipant[homeTeam.id]}>
              {teamToParticipant[homeTeam.id]}
            </span>
          )}
        </div>

        <div style={{
          fontWeight: 800,
          fontSize: 12,
          flexShrink: 0,
          textAlign: 'center',
          minWidth: 28,
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {isFinished || isLive ? (fixture.home_score ?? '-') : '-'}:{isFinished || isLive ? (fixture.away_score ?? '-') : '-'}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 14, height: 14, flexShrink: 0 }} />}
          <span style={{
            fontWeight: awayTeam ? 600 : 400,
            fontSize: 11,
            color: awayTeam ? undefined : 'var(--color-text-muted)',
            fontStyle: awayTeam ? undefined : 'italic',
            }} title={displayAwayLabel}>
            {displayAwayLabel}
          </span>
          {awayTeam && teamToParticipant[awayTeam.id] && (
            <span style={{
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--token-7)',
              textAlign: 'right',
            }} title={teamToParticipant[awayTeam.id]}>
              {teamToParticipant[awayTeam.id]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BracketView({ fixtures, allFixtures = [], teams, participants = [], activeRound, onClick }) {
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
      .sort((a, b) => a.id - b.id);
  }

  const feederPairs = buildFeederPairs(roundFixtures, fixtureMap);

  const getTeam = (id) => teams.find(t => t.id === id);

  return (
    <div style={{
      display: 'flex',
      gap: 24,
      overflowX: 'auto',
      paddingBottom: 12,
      alignItems: 'flex-start',
    }}>
      {BRACKET_ROUNDS.filter(round => !activeRound || round.key === activeRound).map((round, ri) => {
        const matches = roundFixtures[round.key] || [];
        if (matches.length === 0) return null;

        const pairs = feederPairs[round.key] || [];
        const hasPairs = pairs.length > 0;

        return (
          <div key={round.key} style={{ minWidth: 400, flex: 1 }}>
            {hasPairs ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {pairs.map((pair, pi) => {
                  const colorIdx = Math.floor(pi / 2);
                  const color = `var(--token-${(colorIdx % 8) + 2})`;

                  return (
                    <div key={pi} style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                      {pair.map((fid) => {
                        const f = fixtureMap[fid];
                        if (!f) return null;
                        const homeTeam = getTeam(f.home_team_id);
                        const awayTeam = getTeam(f.away_team_id);
                        const isFinished = f.status === 'FT';
                        const isLive = f.status === 'IN_PROGRESS' || f.lifecycle_state === 'IN_PROGRESS';
                        const hLabel = homeTeam?.name ||
                          (f.home_team_id === null ? (feederLabel(f.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
                        const aLabel = awayTeam?.name ||
                          (f.away_team_id === null ? (feederLabel(f.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
                        return (
                          <MatchCardSmall
                            key={fid}
                            fixture={f}
                            homeTeam={homeTeam}
                            awayTeam={awayTeam}
                            teamToParticipant={teamToParticipant}
                            isFinished={isFinished}
                            isLive={isLive}
                            onClick={onClick}
                            homeLabel={hLabel}
                            awayLabel={aLabel}
                            matchNumber={roundPositions[fid]}
                          />
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}>
                {matches.map((f) => {
                  const homeTeam = getTeam(f.home_team_id);
                  const awayTeam = getTeam(f.away_team_id);
                  const isFinished = f.status === 'FT';
                  const isLive = f.status === 'IN_PROGRESS' || f.lifecycle_state === 'IN_PROGRESS';
                  const hLabel = homeTeam?.name ||
                    (f.home_team_id === null ? (feederLabel(f.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
                  const aLabel = awayTeam?.name ||
                    (f.away_team_id === null ? (feederLabel(f.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
                  return (
                    <MatchCardSmall
                      key={f.id}
                      fixture={f}
                      homeTeam={homeTeam}
                      awayTeam={awayTeam}
                      teamToParticipant={teamToParticipant}
                      isFinished={isFinished}
                      isLive={isLive}
                      onClick={onClick}
                      homeLabel={hLabel}
                      awayLabel={aLabel}
                      matchNumber={roundPositions[f.id]}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
