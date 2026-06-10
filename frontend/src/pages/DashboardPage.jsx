import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { getDashboard } from '../api/client';
import ProgressBar from '../components/ui/ProgressBar';
import StageNav from '../components/ui/StageNav';
import GroupCard from '../components/dashboard/GroupCard';
import MatchCard from '../components/dashboard/MatchCard';
import BracketView from '../components/dashboard/BracketView';

export default function DashboardPage() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(null);

  useEffect(() => {
    getDashboard(publicId)
      .then(d => {
        setData(d);
        setActiveStage(d.currentStage);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [publicId]);

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

  const isKnockout = activeStage !== 'Group Stage';

  const stageFixtures = data.fixtures.filter(f => f.stage === activeStage);
  const stageTotal = stageFixtures.length;
  const stageCompleted = stageFixtures.filter(f => f.status === 'FT').length;

  const groupedStandings = {};
  for (const s of data.standings) {
    if (!groupedStandings[s.group_letter]) groupedStandings[s.group_letter] = [];
    groupedStandings[s.group_letter].push(s);
  }
  const groupLetters = Object.keys(groupedStandings).sort();

  const navPages = [
    { label: 'Dashboard', path: `/sweepstake/${publicId}` },
    { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
    { label: 'Leaderboard', path: `/sweepstake/${publicId}/stats` },
    { label: 'Participants', path: `/sweepstake/${publicId}/participants` },
  ];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
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
                background: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
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
      </div>

      <div style={{ marginBottom: 16 }}>
        <StageNav
          current={data.currentStage}
          activeStage={activeStage}
          onSelect={setActiveStage}
        />
      </div>

      <div style={{ marginBottom: 20 }}>
        <ProgressBar
          current={stageCompleted}
          total={stageTotal}
          statusText={activeStage}
        />
      </div>

      {isKnockout ? (
        <BracketView
          fixtures={stageFixtures}
          allFixtures={data.fixtures}
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
