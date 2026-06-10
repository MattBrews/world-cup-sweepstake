import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getDashboard } from '../api/client';
import ProgressBar from '../components/ui/ProgressBar';
import StageNav from '../components/ui/StageNav';
import GroupCard from '../components/dashboard/GroupCard';
import MatchCard from '../components/dashboard/MatchCard';
import BracketView from '../components/dashboard/BracketView';

export default function DashboardPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);

  useEffect(() => {
    getDashboard(slug)
      .then(d => {
        setData(d);
        setActiveStage(d.currentStage);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  }

  if (!data) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>Sweepstake not found.</p>
        <Link to="/" style={{ color: 'var(--color-accent)' }}>Go home</Link>
      </div>
    );
  }

  const teamMap = {};
  for (const t of data.teams) {
    teamMap[t.id] = t;
  }

  const completedFixtures = data.fixtures.filter(
    f => f.status === 'FT' || f.status === 'AET' || f.status === 'PEN'
  );
  const totalFixtures = data.fixtures.length;
  const isKnockout = activeStage !== 'Group Stage';

  const stageFixtures = data.fixtures.filter(f => {
    const round = f.round || '';
    if (activeStage === 'Group Stage') return round.toLowerCase().includes('group');
    return round === activeStage;
  });

  const groupedStandings = {};
  for (const s of data.standings) {
    if (!groupedStandings[s.group_letter]) groupedStandings[s.group_letter] = [];
    groupedStandings[s.group_letter].push(s);
  }
  const groupLetters = Object.keys(groupedStandings).sort();

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>🏆</div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          color: 'var(--color-accent)',
          letterSpacing: '-0.02em',
        }}>
          {data.sweepstake.name}
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 4 }}>
          <Link to={`/sweepstake/${slug}/fixtures`} style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            View Fixtures
          </Link>
          {' · '}
          <Link to={`/sweepstake/${slug}/standings`} style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Standings
          </Link>
          {' · '}
          <Link to={`/sweepstake/${slug}/stats`} style={{ color: 'var(--color-text-muted)', textDecoration: 'underline', textUnderlineOffset: 3 }}>
            Stats
          </Link>
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <ProgressBar
          current={completedFixtures.length}
          total={totalFixtures}
          statusText={data.currentStage}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <StageNav
          current={data.currentStage}
          activeStage={activeStage}
          onSelect={setActiveStage}
        />
      </div>

      {isKnockout ? (
        <BracketView
          fixtures={stageFixtures}
          teams={data.teams}
          participants={data.participants}
        />
      ) : (
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
      )}
    </div>
  );
}
