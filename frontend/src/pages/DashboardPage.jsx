import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { getDashboard, getPredictionLeaderboard } from '../api/client';
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
  const [predLeaderboard, setPredLeaderboard] = useState([]);

  const isPredictionMode = data?.sweepstake?.mode === 'prediction';

  useEffect(() => {
    getDashboard(publicId)
      .then(d => {
        setData(d);
        setActiveStage(d.currentStage);
        if (d.sweepstake?.mode === 'prediction') {
          getPredictionLeaderboard(publicId).then(lb => setPredLeaderboard(lb)).catch(() => {});
        }
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

  const navPages = isPredictionMode
    ? [
      { label: 'Dashboard', path: `/sweepstake/${publicId}` },
      { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures` },
      { label: 'Predictions', path: `/sweepstake/${publicId}/predictions` },
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

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 36, marginBottom: 4 }}>🏆</div>
        <h1 style={{
          fontSize: 32,
          fontWeight: 800,
          background: 'var(--gradient-accent)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          letterSpacing: '-0.02em',
        }}>
          {data.sweepstake.name}
        </h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
          Up Next
        </h3>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {data.fixtures
            .filter(f => f.status !== 'FT')
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, 5)
            .map(f => (
              <div key={f.id} style={{ width: 240, flexShrink: 0 }}>
                <MatchCard
                  fixture={f}
                  homeTeam={teamMap[f.home_team_id]}
                  awayTeam={teamMap[f.away_team_id]}
                  participants={data.participants}
                  teams={data.teams}
                  allFixtures={data.fixtures}
                />
              </div>
            ))}
          {data.fixtures.filter(f => f.status !== 'FT').length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>All matches played.</p>
          )}
        </div>
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

      {isPredictionMode ? (
        <div>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 12 }}>
            Prediction Leaderboard
          </h3>
          {predLeaderboard.length === 0 ? (
            <div className="glass" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
              No predictions submitted yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {predLeaderboard.map((p, i) => (
                <div key={p.id} className="glass" style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 12,
                    background: 'rgba(255,255,255,0.06)',
                    flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{p.name}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-accent)' }}>{p.total_points}</div>
                </div>
              ))}
              <Link
                to={`/sweepstake/${publicId}/predictions`}
                style={{
                  textAlign: 'center',
                  fontSize: 13,
                  color: 'var(--color-accent)',
                  marginTop: 4,
                }}
              >
                View full leaderboard →
              </Link>
            </div>
          )}
        </div>
      ) : isKnockout ? (
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
