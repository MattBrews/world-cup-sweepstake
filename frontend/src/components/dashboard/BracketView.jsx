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

function buildConnections(currentRoundMatches, nextRoundMatches, fixtureMap) {
  const connections = [];
  for (const nm of nextRoundMatches) {
    const feeders = [];
    for (const ph of [nm.home_placeholder, nm.away_placeholder]) {
      if (!ph || !(ph.startsWith('W') || ph.startsWith('L'))) continue;
      const fid = parseInt(ph.slice(1));
      const feeder = fixtureMap[fid];
      if (feeder && currentRoundMatches.find(m => m.id === fid)) {
        feeders.push(fid);
      }
    }
    if (feeders.length === 2) {
      feeders.sort((a, b) => a - b);
      connections.push({ targetId: nm.id, feederIds: feeders });
    }
  }
  return connections.sort((a, b) => a.feederIds[0] - b.feederIds[0]);
}

function MatchCardSmall({ fixture, homeTeam, awayTeam, teamToParticipant, isFinished, isLive, onClick, homeLabel, awayLabel }) {
  const displayHomeLabel = homeLabel || (fixture.home_team_id === null ? 'TBD' : '?');
  const displayAwayLabel = awayLabel || (fixture.away_team_id === null ? 'TBD' : '?');
  const homeParticipant = teamToParticipant[fixture.home_team_id];
  const awayParticipant = teamToParticipant[fixture.away_team_id];

  return (
    <div
      className="glass bracket-card"
      onClick={onClick && (isFinished || isLive) ? () => onClick(fixture.id) : undefined}
      style={{
        padding: '12px 14px',
        borderLeft: `3px solid ${isFinished ? 'var(--token-7)' : isLive ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)'}`,
        cursor: onClick && (isFinished || isLive) ? 'pointer' : undefined,
        transition: 'transform 0.15s, box-shadow 0.15s',
        width: '100%',
      }}
      onMouseEnter={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; } : undefined}
      onMouseLeave={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <span className="team-name" style={{ fontWeight: homeTeam ? 600 : 400, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: homeTeam ? undefined : 'var(--color-text-muted)', fontStyle: homeTeam ? undefined : 'italic' }} title={displayHomeLabel}>{displayHomeLabel}</span>
            <div className="participant-name" style={{ fontSize: 9, color: homeParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={homeParticipant}>{homeParticipant || '\u00A0'}</div>
          </div>
        </div>

        <div className="score" style={{
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
          textAlign: 'center',
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {isFinished || isLive ? (fixture.home_score ?? '-') : '-'}:{isFinished || isLive ? (fixture.away_score ?? '-') : '-'}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span className="team-name" style={{ fontWeight: awayTeam ? 600 : 400, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: awayTeam ? undefined : 'var(--color-text-muted)', fontStyle: awayTeam ? undefined : 'italic' }} title={displayAwayLabel}>{displayAwayLabel}</span>
            <div className="participant-name" style={{ fontSize: 9, color: awayParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={awayParticipant}>{awayParticipant || '\u00A0'}</div>
          </div>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  );
}

function BracketPair({ match1, match2, targetMatch, getTeam, teamToParticipant, fixtureMap, roundPositions, onClick }) {
  const renderMatch = (f) => {
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
        fixture={f}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        teamToParticipant={teamToParticipant}
        isFinished={isFinished}
        isLive={isLive}
        onClick={onClick}
        homeLabel={hLabel}
        awayLabel={aLabel}
      />
    );
  };

  return (
    <div className="bracket-pair" style={{ display: 'flex', alignItems: 'center', width: '100%', minHeight: 90 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{renderMatch(match1)}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>{renderMatch(match2)}</div>
        </div>
      </div>

      <svg className="bracket-connector" width="60" height="100%" style={{ overflow: 'visible', flexShrink: 0 }}>
        <line x1="0" y1="25%" x2="30" y2="25%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="0" y1="75%" x2="30" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="30" y1="25%" x2="30" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="30" y1="50%" x2="60" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      </svg>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {renderMatch(targetMatch)}
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

  const getTeam = (id) => teams.find(t => t.id === id);

  const currentRoundIndex = BRACKET_ROUNDS.findIndex(r => r.key === activeRound);
  const currentRound = BRACKET_ROUNDS[currentRoundIndex];
  const nextRound = BRACKET_ROUNDS[currentRoundIndex + 1];

  const currentMatches = roundFixtures[currentRound?.key] || [];
  const nextMatches = roundFixtures[nextRound?.key] || [];

  const connections = buildConnections(currentMatches, nextMatches, fixtureMap);

  const nextMatchMap = {};
  for (const nm of nextMatches) {
    nextMatchMap[nm.id] = nm;
  }

  const renderMatch = (f) => {
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
        fixture={f}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        teamToParticipant={teamToParticipant}
        isFinished={isFinished}
        isLive={isLive}
        onClick={onClick}
        homeLabel={hLabel}
        awayLabel={aLabel}
      />
    );
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', gap: 40, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: 'var(--color-text-muted)',
        }}>
          {currentRound?.label || activeRound}
        </div>
        {nextRound && (
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: 'var(--color-text-muted)',
            marginLeft: 'auto',
          }}>
            {nextRound.label}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {connections.length > 0 ? (
          connections.map((conn, i) => (
            <BracketPair
              key={i}
              match1={fixtureMap[conn.feederIds[0]]}
              match2={fixtureMap[conn.feederIds[1]]}
              targetMatch={nextMatchMap[conn.targetId]}
              getTeam={getTeam}
              teamToParticipant={teamToParticipant}
              fixtureMap={fixtureMap}
              roundPositions={roundPositions}
              onClick={onClick}
            />
          ))
        ) : (
          currentMatches.map(f => (
            <div key={f.id}>{renderMatch(f)}</div>
          ))
        )}
      </div>
    </div>
  );
}
