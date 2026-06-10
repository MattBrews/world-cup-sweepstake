import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDashboard } from '../api/client';
import GroupCard from '../components/dashboard/GroupCard';

export default function StandingsPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard(slug)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const teamMap = {};
  for (const t of data.teams) teamMap[t.id] = t;

  const groupedStandings = {};
  for (const s of data.standings) {
    if (!groupedStandings[s.group_letter]) groupedStandings[s.group_letter] = [];
    groupedStandings[s.group_letter].push(s);
  }
  const groupLetters = Object.keys(groupedStandings).sort();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to={`/sweepstake/${slug}`} style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: 'var(--color-accent)' }}>
          Full Standings
        </h1>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {groupLetters.map((letter, i) => (
          <GroupCard
            key={letter}
            groupLetter={letter}
            standings={groupedStandings[letter]}
            participants={data.participants}
            teamMap={teamMap}
            tokenIndex={i}
          />
        ))}
      </div>
    </div>
  );
}
