import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDashboard, getRounds } from '../api/client';
import MatchCard from '../components/dashboard/MatchCard';

export default function FixturesPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [filterRound, setFilterRound] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getDashboard(slug), getRounds(slug)])
      .then(([d, r]) => {
        setData(d);
        setRounds(r);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const teamMap = {};
  for (const t of data.teams) teamMap[t.id] = t;

  let fixtures = data.fixtures;
  if (filterRound) fixtures = fixtures.filter(f => f.round === filterRound);
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to={`/sweepstake/${slug}`} style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: 'var(--color-accent)' }}>
          Fixtures & Results
        </h1>
      </div>

      <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setFilterRound('')}
          style={{
            padding: '6px 14px',
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            background: !filterRound ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
            color: !filterRound ? '#fff' : 'var(--color-text)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          All
        </button>
        {rounds.map(r => (
          <button
            key={r}
            onClick={() => setFilterRound(r)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: filterRound === r ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
              color: filterRound === r ? '#fff' : 'var(--color-text)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {fixtures.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 40 }}>
            No fixtures found.
          </p>
        ) : (
          fixtures.map(f => (
            <MatchCard
              key={f.id}
              fixture={f}
              homeTeam={teamMap[f.home_team_id]}
              awayTeam={teamMap[f.away_team_id]}
              participants={data.participants}
            />
          ))
        )}
      </div>
    </div>
  );
}
