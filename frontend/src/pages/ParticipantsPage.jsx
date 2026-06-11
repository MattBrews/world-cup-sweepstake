import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDashboard, getParticipants } from '../api/client';
import NavBar from '../components/ui/NavBar';

export default function ParticipantsPage() {
  const { publicId } = useParams();
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

  const isPredictionMode = data?.sweepstake?.mode === 'prediction';

  const grouped = {};
  for (const p of participantList) {
    if (!grouped[p.name]) grouped[p.name] = [];
    grouped[p.name].push(p);
  }

  const navPages = isPredictionMode
    ? [
      { label: 'Dashboard', path: `/sweepstake/${publicId}` },
      { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
      { label: 'Predictions', path: `/sweepstake/${publicId}/predictions` },
      { label: 'Leaderboard', path: `/sweepstake/${publicId}/leaderboard` },
      { label: 'Participants', path: `/sweepstake/${publicId}/participants` },
    ]
    : [
      { label: 'Dashboard', path: `/sweepstake/${publicId}` },
      { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
      { label: 'Leaderboard', path: `/sweepstake/${publicId}/stats` },
      { label: 'Participants', path: `/sweepstake/${publicId}/participants` },
    ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', overflowX: 'hidden' }}>
      <NavBar navPages={navPages} />

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20, color: 'var(--color-accent)' }}>
        Participants
      </h1>

      {Object.keys(grouped).length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No participants assigned yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {Object.entries(grouped).map(([name, teams]) => (
            <div key={name} className="glass" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '14px 20px',
                fontWeight: 700,
                fontSize: 16,
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                {name}
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)' }}>
                  {teams.length} {teams.length === 1 ? 'team' : 'teams'}
                </span>
              </div>
              {teams.map(t => {
                const team = teamMap[t.team_id];
                return (
                  <div
                    key={t.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 20px',
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                    }}
                  >
                    {team?.logo_url && (
                      <img src={team.logo_url} alt="" style={{ width: 22, height: 22 }} />
                    )}
                    <div>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{t.team_name}</span>
                      {team?.group_letter && (
                        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                          Group {team.group_letter}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
