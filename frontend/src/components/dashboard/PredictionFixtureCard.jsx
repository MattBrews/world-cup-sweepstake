import { feederLabel, buildRoundPositions, shortRound } from '../../utils/fixtureLabels';

export default function PredictionFixtureCard({ fixture, allFixtures }) {
  const date = new Date(fixture.date);
  const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
  const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

  const fixtureMap = {};
  if (allFixtures) for (const f of allFixtures) fixtureMap[f.id] = f;
  const roundPositions = allFixtures ? buildRoundPositions(allFixtures) : {};
  const matchPos = roundPositions[fixture.id];

  const home = fixture.home_team_name || (fixture.home_team_id === null ? (feederLabel(fixture.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
  const away = fixture.away_team_name || (fixture.away_team_id === null ? (feederLabel(fixture.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
  const hasScore = fixture.home_score !== null && fixture.away_score !== null;

  return (
    <div className="glass" style={{ padding: '10px 12px' }}>
      <div style={{ fontSize: 9, color: 'var(--color-text-muted)', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{fixture.group_letter ? `Group ${fixture.group_letter} · ` : ''}{shortRound(fixture.stage)} #{matchPos} &middot; {dateStr}</span>
        <span>{timeStr}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
          {fixture.home_logo && <img src={fixture.home_logo} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />}
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={home}>{home}</span>
        </div>

        <div style={{
          fontSize: 14,
          fontWeight: 700,
          flexShrink: 0,
          minWidth: 50,
          textAlign: 'center',
          padding: '2px 6px',
          borderRadius: 6,
          background: hasScore ? 'rgba(68,207,121,0.1)' : 'rgba(255,255,255,0.03)',
          border: hasScore ? '1px solid rgba(68,207,121,0.2)' : '1px dashed rgba(255,255,255,0.1)',
        }}>
          {hasScore ? (
            <span style={{ color: 'var(--color-text)' }}>
              {fixture.home_score} - {fixture.away_score}
            </span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>vs</span>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={away}>{away}</span>
          {fixture.away_logo && <img src={fixture.away_logo} alt="" style={{ width: 16, height: 16, flexShrink: 0 }} />}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {fixture.participant_predictions.map(p => {
          const hasPrediction = p.predicted_home !== null && p.predicted_home !== undefined;
          return (
            <div
              key={p.participant_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '3px 8px',
                borderRadius: 4,
                background: hasPrediction ? 'rgba(68,207,121,0.08)' : 'rgba(255,255,255,0.02)',
                border: hasPrediction ? '1px solid rgba(68,207,121,0.15)' : '1px solid rgba(255,255,255,0.04)',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: hasPrediction ? 'var(--token-7)' : 'var(--color-text-muted)' }}>
                {p.participant_name}
              </span>
              {hasPrediction && (
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>
                  {p.predicted_home}-{p.predicted_away}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
