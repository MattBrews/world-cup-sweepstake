import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { getPredictions, submitPrediction } from '../api/client';
import NavBar from '../components/ui/NavBar';

function ukDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', { timeZone: 'Europe/London' });
}

function formatDateLabel(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
}

function formatDateHeader(isoStr) {
  const d = new Date(isoStr + 'T12:00:00+01:00');
  return d.toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
    timeZone: 'Europe/London',
  });
}

export default function PredictionsPage() {
  const { publicId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scores, setScores] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [msg, setMsg] = useState('');

  const STORAGE_KEY = `wc_pred_token_${publicId}`;

  const token = searchParams.get('token') || localStorage.getItem(STORAGE_KEY) || '';

  async function load() {
    setLoading(true);
    try {
      const d = await getPredictions(publicId, token);
      setData(d);

      const initial = {};
      for (const p of d.predictions) {
        initial[`${p.fixture_id}-h`] = p.home_score;
        initial[`${p.fixture_id}-a`] = p.away_score;
      }
      setScores(initial);
    } catch { setData(null); }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [publicId, token]);

  function handleTokenSubmit(e) {
    e.preventDefault();
    if (tokenInput) {
      localStorage.setItem(STORAGE_KEY, tokenInput);
      setSearchParams({ token: tokenInput });
    }
  }

  const [tokenInput, setTokenInput] = useState(token);

  async function handleSubmit(fixtureId) {
    if (!token) return;
    const hs = parseInt(scores[`${fixtureId}-h`], 10);
    const as = parseInt(scores[`${fixtureId}-a`], 10);
    if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) return;

    setSubmitting(prev => ({ ...prev, [fixtureId]: true }));
    setMsg('');
    try {
      await submitPrediction(publicId, token, fixtureId, hs, as);
      setMsg('Prediction saved');
      await load();
    } catch (err) {
      setMsg('Error: ' + err.message);
    }
    setSubmitting(prev => ({ ...prev, [fixtureId]: false }));
  }

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;

  const teamMap = {};
  if (data) for (const t of data.teams) teamMap[t.id] = t;

  const predictionsByFixture = {};
  if (data) for (const p of data.predictions) predictionsByFixture[p.fixture_id] = p;

  const navPages = [
    { label: 'Dashboard', path: `/sweepstake/${publicId}` },
    { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
    { label: 'Predictions', path: `/sweepstake/${publicId}/predictions` },
    { label: 'Leaderboard', path: `/sweepstake/${publicId}/leaderboard` },
    { label: 'Standings', path: `/sweepstake/${publicId}/standings` },
    { label: 'Participants', path: `/sweepstake/${publicId}/participants` },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', overflowX: 'hidden' }}>
      <NavBar navPages={navPages} />

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, color: 'var(--color-accent)' }}>
        Predictions
      </h1>
      {data?.participant && (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Predicting as <strong style={{ color: 'var(--color-text)' }}>{data.participant.name}</strong>
        </div>
      )}

      {msg && (
        <div style={{
          fontSize: 13,
          padding: '8px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: msg.startsWith('Error') ? 'rgba(229,62,62,0.15)' : 'rgba(68,207,121,0.15)',
          color: msg.startsWith('Error') ? 'var(--token-1)' : 'var(--token-7)',
        }}>
          {msg}
        </div>
      )}

      {!token || !data?.participant ? (
        <div className="glass" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Enter your prediction token to make and view your predictions.
          </div>
          <form onSubmit={handleTokenSubmit} style={{ display: 'flex', gap: 8, maxWidth: 400, margin: '0 auto' }}>
            <input
              value={tokenInput}
              onChange={e => setTokenInput(e.target.value)}
              placeholder="Paste your prediction token"
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: 8,
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'rgba(255,255,255,0.04)',
                color: '#fff',
                fontSize: 14,
                outline: 'none',
              }}
            />
            <button type="submit" style={{
              padding: '10px 20px',
              borderRadius: 8,
              background: 'var(--gradient-accent)',
              color: '#fff',
              fontWeight: 700,
              fontSize: 14,
            }}>
              Go
            </button>
          </form>
        </div>
      ) : data?.fixtures?.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No fixtures loaded yet.
        </div>
      ) : (
        (() => {
          const groups = {};
          for (const f of data.fixtures) {
            const d = ukDate(f.date);
            if (!groups[d]) groups[d] = [];
            groups[d].push(f);
          }
          return Object.entries(groups).map(([dateStr, list]) => {
            const dt = new Date(dateStr + 'T12:00:00+01:00');
            const label = dt.toLocaleDateString('en-GB', {
              weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
              timeZone: 'Europe/London',
            });
            return (
              <div key={dateStr} style={{ marginBottom: 20 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--color-accent)',
                  marginBottom: 8,
                  paddingLeft: 4,
                }}>
                  {label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map(f => {
                    const homeTeam = teamMap[f.home_team_id];
                    const awayTeam = teamMap[f.away_team_id];
                    const isScheduled = f.status !== 'FT';
                    const pred = predictionsByFixture[f.id];
                    const saved_h = pred?.home_score;
                    const saved_a = pred?.away_score;
                    const current_h = scores[`${f.id}-h`] ?? (saved_h ?? '');
                    const current_a = scores[`${f.id}-a`] ?? (saved_a ?? '');
                    const isSubmitting = submitting[f.id];

                    const homeLabel = homeTeam?.name || f.home_placeholder || 'TBD';
                    const awayLabel = awayTeam?.name || f.away_placeholder || 'TBD';

                    const date = new Date(f.date);
                    const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' });
                    const dateStr = date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/London' });

                    return (
                      <div key={f.id} className="glass" style={{
                        padding: '14px 16px',
                        borderLeft: `3px solid ${isScheduled ? 'rgba(255,255,255,0.1)' : 'var(--token-7)'}`,
                      }}>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{dateStr}</span>
                          <span>{timeStr}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
                            {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
                            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={homeLabel}>{homeLabel}</span>
                          </div>

                          {isScheduled ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <input
                                type="number"
                                min="0"
                                value={current_h}
                                onChange={e => setScores(prev => ({ ...prev, [`${f.id}-h`]: e.target.value }))}
                                style={{
                                  width: 40,
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: '#fff',
                                  fontSize: 16,
                                  fontWeight: 700,
                                  outline: 'none',
                                }}
                              />
                              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>:</span>
                              <input
                                type="number"
                                min="0"
                                value={current_a}
                                onChange={e => setScores(prev => ({ ...prev, [`${f.id}-a`]: e.target.value }))}
                                style={{
                                  width: 40,
                                  padding: '6px 4px',
                                  textAlign: 'center',
                                  borderRadius: 6,
                                  border: '1px solid rgba(255,255,255,0.08)',
                                  background: 'rgba(255,255,255,0.04)',
                                  color: '#fff',
                                  fontSize: 16,
                                  fontWeight: 700,
                                  outline: 'none',
                                }}
                              />
                            </div>
                          ) : (
                            <div style={{ fontWeight: 800, fontSize: 16, flexShrink: 0, whiteSpace: 'nowrap' }}>
                              {f.home_score ?? '-'}:{f.away_score ?? '-'}
                            </div>
                          )}

                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={awayLabel}>{awayLabel}</span>
                            {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
                          </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                          <div>
                            {saved_h !== undefined && isScheduled && (
                              <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                                Your pick: {saved_h}-{saved_a}
                              </span>
                            )}
                            {pred?.points !== undefined && pred?.points !== null && (
                              <span style={{ fontSize: 12, color: 'var(--token-7)', fontWeight: 600 }}>
                                Your pick: {saved_h}-{saved_a} → <strong>{pred.points}pts</strong>
                              </span>
                            )}
                          </div>
                          {isScheduled && (
                            <button
                              onClick={() => handleSubmit(f.id)}
                              disabled={isSubmitting || current_h === '' || current_a === ''}
                              style={{
                                padding: '6px 16px',
                                borderRadius: 6,
                                background: current_h !== '' && current_a !== '' ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.06)',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: 12,
                                opacity: isSubmitting ? 0.6 : 1,
                              }}
                            >
                              {isSubmitting ? 'Saving...' : saved_h !== undefined ? 'Update' : 'Save'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()
      )}
    </div>
  );
}
