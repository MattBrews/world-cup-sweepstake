import { feederLabel, buildRoundPositions } from '../../utils/fixtureLabels';

function tvLabel(channel) {
  if (!channel) return '';
  if (/^BBC/i.test(channel)) return 'BBC';
  if (/^ITV/i.test(channel)) return 'ITV';
  return channel;
}

export default function MatchCard({ fixture, homeTeam, awayTeam, participants, teams, allFixtures }) {
  const homeParticipant = participants.find(p => p.team_id === fixture.home_team_id);
  const awayParticipant = participants.find(p => p.team_id === fixture.away_team_id);
  const isFinished = fixture.status === 'FT';
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
      borderLeft: `3px solid ${isLive ? 'var(--color-accent)' : isFinished ? 'var(--token-7)' : 'rgba(255,255,255,0.1)'}`,
    }}>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {isLive ? (
          <div>🔴 LIVE</div>
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
