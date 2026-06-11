import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getPredictionLeaderboard } from '../api/client';
import NavBar from '../components/ui/NavBar';

export default function LeaderboardPage() {
  const { publicId } = useParams();
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPredictionLeaderboard(publicId)
      .then(lb => setLeaderboard(lb))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicId]);

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

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20, color: 'var(--color-accent)' }}>
        Leaderboard
      </h1>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : leaderboard.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
          No predictions yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {leaderboard.map((p, i) => (
            <div key={p.id} className="glass" style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                background: 'rgba(255,255,255,0.06)',
                flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {p.matches_scored} match{p.matches_scored === 1 ? '' : 'es'} scored
                </div>
              </div>
              <div style={{
                fontSize: 28,
                fontWeight: 800,
                color: 'var(--color-accent)',
              }}>
                {p.total_points}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
