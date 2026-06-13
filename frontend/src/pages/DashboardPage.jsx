import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { getDashboard, getRecentResults } from '../api/client';
import ProgressBar from '../components/ui/ProgressBar';
import StageNav from '../components/ui/StageNav';
import GroupCard from '../components/dashboard/GroupCard';
import MatchCard from '../components/dashboard/MatchCard';
import BracketView from '../components/dashboard/BracketView';
import MatchDetailModal from '../components/dashboard/MatchDetailModal';

export default function DashboardPage() {
  const { publicId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState(searchParams.get('stage') || null);
  const [recentResults, setRecentResults] = useState([]);
  const [selectedMatchId, setSelectedMatchId] = useState(null);

  useEffect(() => {
    Promise.all([
      getDashboard(publicId).then(d => { setData(d); setActiveStage(d.currentStage); }).catch(() => setData(null)),
      getRecentResults(publicId).then(setRecentResults).catch(() => {}),
    ]).finally(() => setLoading(false));
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
  const liveFixtures = data.fixtures.filter(f => f.status === 'IN_PROGRESS' || f.lifecycle_state === 'IN_PROGRESS');

  const groupedStandings = {};
  for (const s of data.standings) {
    if (!groupedStandings[s.group_letter]) groupedStandings[s.group_letter] = [];
    groupedStandings[s.group_letter].push(s);
  }
  const groupLetters = Object.keys(groupedStandings).sort();

  function setStage(stage) {
    setActiveStage(stage);
    if (stage) setSearchParams({ stage });
    else setSearchParams({});
  }

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

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
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
            .filter(f => f.status !== 'FT' && f.status !== 'AWAITING' && f.status !== 'IN_PROGRESS' && f.lifecycle_state !== 'IN_PROGRESS')
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
                  onClick={setSelectedMatchId}
                />
              </div>
            ))}
          {data.fixtures.filter(f => f.status !== 'FT' && f.status !== 'AWAITING' && f.status !== 'IN_PROGRESS' && f.lifecycle_state !== 'IN_PROGRESS').length === 0 && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: 13, padding: '8px 0' }}>All matches played.</p>
          )}
        </div>
      </div>

      {liveFixtures.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', marginBottom: 8 }}>
            🔴 Live Now
          </h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {liveFixtures.map(f => (
              <div key={f.id} style={{ width: 240, flexShrink: 0 }}>
                <MatchCard
                  fixture={f}
                  homeTeam={teamMap[f.home_team_id]}
                  awayTeam={teamMap[f.away_team_id]}
                  participants={data.participants}
                  teams={data.teams}
                  allFixtures={data.fixtures}
                  onClick={setSelectedMatchId}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {recentResults.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
            Latest Games
          </h3>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
            {recentResults.map(f => (
              <div key={f.id} style={{ width: 240, flexShrink: 0 }}>
                <MatchCard
                  fixture={f}
                  homeTeam={teamMap[f.home_team_id]}
                  awayTeam={teamMap[f.away_team_id]}
                  participants={data.participants}
                  teams={data.teams}
                  allFixtures={data.fixtures}
                  compact
                  onClick={setSelectedMatchId}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <StageNav
          current={data.currentStage}
          activeStage={activeStage}
          onSelect={setStage}
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
          onClick={setSelectedMatchId}
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
      <MatchDetailModal
        publicId={publicId}
        matchId={selectedMatchId}
        onClose={() => setSelectedMatchId(null)}
      />
    </div>
  );
}
