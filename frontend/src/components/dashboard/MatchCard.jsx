const SHORT_ROUNDS = {
  'Group Stage': 'GS',
  'Round of 32': 'R32',
  'Round of 16': 'R16',
  'Quarter-finals': 'QF',
  'Semi-finals': 'SF',
  '3rd Place': '3rd',
  'Final': 'Final',
};

function shortRound(key) {
  return SHORT_ROUNDS[key] || key;
}

function tvLabel(channel) {
  if (!channel) return '';
  if (/^BBC/i.test(channel)) return 'BBC';
  if (/^ITV/i.test(channel)) return 'ITV';
  return channel;
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

export default function MatchCard({ fixture, homeTeam, awayTeam, participants, teams, allFixtures }) {
  const homeParticipant = participants.find(p => p.team_id === fixture.home_team_id);
  const awayParticipant = participants.find(p => p.team_id === fixture.away_team_id);
  const isFinished = fixture.status === 'FT';
  const isAwaiting = fixture.status === 'AWAITING';
  const isLive = false;

  const fixtureMap = {};
  if (allFixtures) for (const f of allFixtures) fixtureMap[f.id] = f;
  const roundPositions = allFixtures ? buildRoundPositions(allFixtures) : {};

  const homeLabel = homeTeam?.name || (fixture.home_team_id === null ? (feederLabel(fixture.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
  const awayLabel = awayTeam?.name || (fixture.away_team_id === null ? (feederLabel(fixture.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');

  const date = new Date(fixture.date);
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

  return (
    <div className="glass" style={{
      padding: '14px 16px',
      borderLeft: `3px solid ${isLive ? 'var(--color-accent)' : isFinished ? 'var(--token-7)' : isAwaiting ? 'var(--token-4)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {isLive ? (
          <div>🔴 LIVE</div>
        ) : isAwaiting ? (
          <div style={{ color: 'var(--token-4)' }}>⏳ Awaiting result</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{dateStr}</span>
              {tvLabel(fixture.tv_channel) && <span>{tvLabel(fixture.tv_channel)}</span>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{timeStr}</span>
              {fixture.venue && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%', textAlign: 'right' }} title={fixture.venue}>{fixture.venue}</span>}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: homeTeam ? 600 : 400, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: homeTeam ? undefined : 'var(--color-text-muted)', fontStyle: homeTeam ? undefined : 'italic' }} title={homeLabel}>{homeLabel}</span>
            <div style={{ fontSize: 10, color: homeParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={homeParticipant?.name}>{homeParticipant?.name || '\u00A0'}</div>
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
          ) : isAwaiting ? (
            <span style={{ color: 'var(--token-4)', fontSize: 13, whiteSpace: 'nowrap' }}>?:?</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 13, whiteSpace: 'nowrap' }}>vs</span>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontWeight: awayTeam ? 600 : 400, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: awayTeam ? undefined : 'var(--color-text-muted)', fontStyle: awayTeam ? undefined : 'italic' }} title={awayLabel}>{awayLabel}</span>
            <div style={{ fontSize: 10, color: awayParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={awayParticipant?.name}>{awayParticipant?.name || '\u00A0'}</div>
          </div>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  );
}
