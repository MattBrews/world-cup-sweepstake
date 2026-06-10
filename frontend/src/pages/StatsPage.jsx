import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getDashboard } from '../api/client';
import Toggle from '../components/ui/Toggle';

export default function StatsPage() {
  const { slug } = useParams();
  const [data, setData] = useState(null);
  const [view, setView] = useState('team');
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

  const allStandings = data.standings;
  const participants = data.participants;

  const teamStats = {};
  for (const s of allStandings) {
    teamStats[s.team_id] = {
      ...s,
      name: teamMap[s.team_id]?.name || `Team #${s.team_id}`,
      logo: teamMap[s.team_id]?.logo_url || null,
    };
  }

  let leaderboard = [];

  if (view === 'person') {
    leaderboard = participants
      .map(p => {
        const stats = teamStats[p.team_id];
        return {
          ...p,
          points: stats?.points ?? 0,
          goalDiff: stats?.goal_diff ?? 0,
          played: stats?.played ?? 0,
          rank: stats?.rank ?? '-',
          group: stats?.group_letter ?? '-',
        };
      })
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  } else {
    const participantTeamIds = new Set(participants.map(p => p.team_id));
    leaderboard = Object.values(teamStats)
      .map(s => ({
        team_id: s.team_id,
        name: s.name,
        logo: s.logo,
        points: s.points,
        goalDiff: s.goal_diff,
        played: s.played,
        rank: s.rank,
        group: s.group_letter,
        claimedBy: participants.find(p => p.team_id === s.team_id)?.name || null,
      }))
      .sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff);
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <Link to={`/sweepstake/${slug}`} style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          ← Back to Dashboard
        </Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 8, color: 'var(--color-accent)' }}>
          Leaderboard
        </h1>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Toggle
          options={[
            { label: 'Team View', value: 'team' },
            { label: 'Person View', value: 'person' },
          ]}
          selected={view}
          onSelect={setView}
        />
      </div>

      <div className="glass" style={{ overflow: 'hidden' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '40px 1fr 60px 60px 60px 60px',
          gap: 4,
          padding: '12px 20px',
          fontSize: 11,
          fontWeight: 700,
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <span>#</span>
          <span>{view === 'person' ? 'Person / Team' : 'Team'}</span>
          <span style={{ textAlign: 'center' }}>Pts</span>
          <span style={{ textAlign: 'center' }}>GD</span>
          <span style={{ textAlign: 'center' }}>Pld</span>
          <span style={{ textAlign: 'center' }}>Grp</span>
        </div>

        {leaderboard.map((item, i) => (
          <div
            key={view === 'person' ? item.id : item.team_id}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 60px 60px 60px 60px',
              gap: 4,
              padding: '10px 20px',
              fontSize: 14,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
              {i + 1}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {item.logo && <img src={item.logo} alt="" style={{ width: 20, height: 20 }} />}
              <div>
                <span style={{ fontWeight: 600 }}>{view === 'person' ? item.name : item.name}</span>
                {view === 'person' && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    ({teamMap[item.team_id]?.name || item.team_id})
                  </span>
                )}
                {view === 'team' && item.claimedBy && (
                  <span style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: 'var(--color-accent)',
                    fontWeight: 500,
                  }}>
                    {item.claimedBy}
                  </span>
                )}
              </div>
            </div>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>{item.points}</span>
            <span style={{ textAlign: 'center', color: item.goalDiff > 0 ? 'var(--token-7)' : item.goalDiff < 0 ? 'var(--token-1)' : undefined }}>
              {item.goalDiff > 0 ? `+${item.goalDiff}` : item.goalDiff}
            </span>
            <span style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{item.played}</span>
            <span style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{item.group}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
