import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getDashboard } from '../api/client';
import Toggle from '../components/ui/Toggle';

export default function StatsPage() {
  const { publicId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [view, setView] = useState('team');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboard(publicId)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [publicId]);

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
    const groupedByPerson = {};
    for (const p of participants) {
      if (!groupedByPerson[p.name]) {
        groupedByPerson[p.name] = { name: p.name, teams: [] };
      }
      const stats = teamStats[p.team_id] || {};
      groupedByPerson[p.name].teams.push({
        teamName: p.team_name,
        teamId: p.team_id,
        points: stats.points ?? 0,
        goalDiff: stats.goal_diff ?? 0,
        played: stats.played ?? 0,
        rank: stats.rank ?? '-',
        group: stats.group_letter ?? '-',
        logo: teamMap[p.team_id]?.logo_url || null,
      });
    }

    leaderboard = Object.values(groupedByPerson)
      .map(person => ({
        ...person,
        totalPoints: person.teams.reduce((s, t) => s + t.points, 0),
        totalGD: person.teams.reduce((s, t) => s + t.goalDiff, 0),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints || b.totalGD - a.totalGD);
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

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20, color: 'var(--color-accent)' }}>
        Leaderboard
      </h1>

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

      {view === 'person' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {leaderboard.map((person, i) => (
            <div key={person.name} className="glass" style={{ overflow: 'hidden' }}>
              <div style={{
                padding: '12px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    fontWeight: 700,
                    color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontSize: 16,
                  }}>
                    #{i + 1}
                  </span>
                  <span style={{ fontWeight: 700, fontSize: 16 }}>{person.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <strong style={{ color: 'var(--color-text)', fontSize: 15 }}>{person.totalPoints}</strong> pts
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    <strong style={{ color: person.totalGD > 0 ? 'var(--token-7)' : 'var(--color-text)', fontSize: 15 }}>
                      {person.totalGD > 0 ? `+${person.totalGD}` : person.totalGD}
                    </strong> GD
                  </span>
                </div>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '28px 1fr 60px 60px 60px 60px',
                gap: 4,
                padding: '6px 20px',
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <span />
                <span>Team</span>
                <span style={{ textAlign: 'center' }}>Pts</span>
                <span style={{ textAlign: 'center' }}>GD</span>
                <span style={{ textAlign: 'center' }}>Pld</span>
                <span style={{ textAlign: 'center' }}>Grp</span>
              </div>
              {person.teams.map((t, ti) => (
                <div key={ti} style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 1fr 60px 60px 60px 60px',
                  gap: 4,
                  padding: '8px 20px',
                  fontSize: 13,
                  background: ti % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  alignItems: 'center',
                }}>
                  {t.logo ? (
                    <img src={t.logo} alt="" style={{ width: 18, height: 18 }} />
                  ) : (
                    <span />
                  )}
                  <span style={{ fontWeight: 500 }}>{t.teamName}</span>
                  <span style={{ textAlign: 'center', fontWeight: 600 }}>{t.points}</span>
                  <span style={{ textAlign: 'center', color: t.goalDiff > 0 ? 'var(--token-7)' : t.goalDiff < 0 ? 'var(--token-1)' : undefined }}>
                    {t.goalDiff > 0 ? `+${t.goalDiff}` : t.goalDiff}
                  </span>
                  <span style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>{t.played}</span>
                  <span style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 12 }}>{t.group}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
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
            <span>Team</span>
            <span style={{ textAlign: 'center' }}>Pts</span>
            <span style={{ textAlign: 'center' }}>GD</span>
            <span style={{ textAlign: 'center' }}>Pld</span>
            <span style={{ textAlign: 'center' }}>Grp</span>
          </div>

          {leaderboard.map((item, i) => (
            <div
              key={item.team_id}
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
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  {item.claimedBy && (
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
      )}
    </div>
  );
}
