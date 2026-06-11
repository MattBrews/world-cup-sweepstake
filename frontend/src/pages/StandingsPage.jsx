import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getDashboard } from '../api/client';
import NavBar from '../components/ui/NavBar';
import GroupCard from '../components/dashboard/GroupCard';
import BracketView from '../components/dashboard/BracketView';

export default function StandingsPage() {
  const { publicId } = useParams();
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

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const teamMap = {};
  for (const t of data.teams) teamMap[t.id] = t;

  const isKnockout = activeStage !== 'Group Stage';
  const stageFixtures = data.fixtures.filter(f => f.stage === activeStage);

  const groupedStandings = {};
  for (const s of data.standings) {
    if (!groupedStandings[s.group_letter]) groupedStandings[s.group_letter] = [];
    groupedStandings[s.group_letter].push(s);
  }
  const groupLetters = Object.keys(groupedStandings).sort();

  const stages = [...new Set(data.fixtures.map(f => f.stage))];
  const stageOrder = ['Group Stage', 'Round of 32', 'Round of 16', 'Quarter-finals', 'Semi-finals', '3rd Place', 'Final'];
  stages.sort((a, b) => stageOrder.indexOf(a) - stageOrder.indexOf(b));

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
        Tournament Standings
      </h1>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {stages.map(stage => (
          <button
            key={stage}
            onClick={() => setActiveStage(stage)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              background: activeStage === stage ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.04)',
              color: activeStage === stage ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {stage}
          </button>
        ))}
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
