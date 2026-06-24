import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getDashboard, getParticipants } from '../api/client';

export default function ParticipantsPage() {
  const { publicId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [participantList, setParticipantList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(publicId), getParticipants(publicId)])
      .then(([d, p]) => {
        setData(d);
        setParticipantList(p);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [publicId]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const teamMap = {};
  for (const t of data.teams) teamMap[t.id] = t;

  const grouped = {};
  for (const p of participantList) {
    if (!grouped[p.name]) grouped[p.name] = [];
    grouped[p.name].push(p);
  }

  const isEliminatedPerson = (teams) => teams.every(t => t.status === 'ELIMINATED');

  const sortedEntries = Object.entries(grouped).sort(([_a, teamsA], [_b, teamsB]) => {
    const aOut = isEliminatedPerson(teamsA);
    const bOut = isEliminatedPerson(teamsB);
    if (aOut && !bOut) return 1;
    if (!aOut && bOut) return -1;
    return 0;
  });

  const navPages = [
    { label: 'Dashboard', path: `/sweepstake/${publicId}` },
    { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
    { label: 'Leaderboard', path: `/sweepstake/${publicId}/stats` },
    { label: 'Participants', path: `/sweepstake/${publicId}/participants` },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', overflowX: 'hidden' }}>
      <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
        {navPages.map(p => {
          const isActive = location.pathname === p.path;
          return (
            <Link
              key={p.label}
              to={p.path}
              style={{
                flex: 1,
                padding: '8px 8px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                textAlign: 'center',
                background: isActive ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fff' : 'var(--color-text)',
                border: '1px solid rgba(255,255,255,0.06)',
                textDecoration: 'none',
                transition: 'all 0.2s',
              }}
            >
              {p.label}
            </Link>
          );
        })}
      </div>

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20, color: 'var(--color-accent)' }}>
        Participants
      </h1>

      {Object.keys(grouped).length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No participants assigned yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sortedEntries.map(([name, teams]) => {
            const allOut = isEliminatedPerson(teams);
            const sortedTeams = [...teams].sort((a, b) => {
              if (a.status === 'ELIMINATED' && b.status !== 'ELIMINATED') return 1;
              if (a.status !== 'ELIMINATED' && b.status === 'ELIMINATED') return -1;
              return 0;
            });
            return (
            <div className="glass" style={{
              overflow: 'hidden',
              opacity: allOut ? 0.55 : 1,
              background: allOut ? 'rgba(229,62,62,0.06)' : undefined,
              border: allOut ? '1px solid rgba(229,62,62,0.15)' : undefined,
              transition: 'all 0.2s',
            }}>
              <div style={{
                padding: '14px 20px',
                fontWeight: 700,
                fontSize: 16,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div>
                  {name}
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                    {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                  </span>
                </div>
                {allOut && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 4,
                    background: 'rgba(229,62,62,0.15)',
                    color: '#fc8181',
                    whiteSpace: 'nowrap',
                  }}>
                    Out of the running
                  </span>
                )}
              </div>
              {sortedTeams.map(t => {
                const team = teamMap[t.team_id];
                const isOut = t.status === 'ELIMINATED';
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      opacity: isOut ? 0.55 : 1,
                      background: isOut ? 'rgba(229,62,62,0.06)' : undefined,
                      position: 'relative',
                    }}
                  >
                    {isOut && (
                      <div style={{
                        position: 'absolute',
                        left: 20,
                        right: 20,
                        top: '50%',
                        height: 2.5,
                        background: '#e53e3e',
                        transform: 'translateY(-50%)',
                        opacity: 0.55,
                        pointerEvents: 'none',
                      }} />
                    )}
                    {team?.logo_url && (
                      <img src={team.logo_url} alt="" style={{ width: 22, height: 22 }} />
                    )}
                    <div style={{ flex: 1 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{t.team_name}</span>
                      {team?.group_letter && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                          Group {team.group_letter}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: 4,
                      background: isOut ? 'rgba(229,62,62,0.12)' : 'rgba(56,161,105,0.12)',
                      color: isOut ? '#fc8181' : '#68d391',
                      whiteSpace: 'nowrap',
                      position: 'relative',
                      zIndex: 1,
                    }}>
                      {isOut ? 'Eliminated' : 'Active'}
                    </span>
                  </div>
                );
              })}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
