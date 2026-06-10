import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { getDashboard } from '../api/client';
import MatchCard from '../components/dashboard/MatchCard';

export default function FixturesPage() {
  const { publicId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [filterDate, setFilterDate] = useState('');
  const [viewMode, setViewMode] = useState('all');
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

  let fixtures = data.fixtures;
  if (filterDate) {
    if (viewMode === 'month') {
      const m = filterDate.slice(0, 7);
      fixtures = fixtures.filter(f => f.date.slice(0, 7) === m);
    } else if (viewMode === 'week') {
      const start = new Date(filterDate + 'T12:00:00Z');
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 7);
      fixtures = fixtures.filter(f => {
        const d = new Date(f.date);
        return d >= start && d < end;
      });
    } else {
      fixtures = fixtures.filter(f => f.date.slice(0, 10) === filterDate);
    }
  }
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));

  const dates = [...new Set(data.fixtures.map(f => f.date.slice(0, 10)))].sort();

  const monthLabels = {};
  for (const d of dates) {
    const m = d.slice(0, 7);
    if (!monthLabels[m]) {
      const dt = new Date(m + '-01T12:00:00Z');
      monthLabels[m] = dt.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    }
  }
  const months = Object.keys(monthLabels).sort();

  const weekLabels = {};
  for (const d of dates) {
    const dt = new Date(d + 'T12:00:00Z');
    const start = new Date(dt);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const key = start.toISOString().slice(0, 10);
    if (!weekLabels[key]) {
      const s = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      const e = end.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
      weekLabels[key] = `${s} – ${e}`;
    }
  }
  const weeks = Object.keys(weekLabels).sort();

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

      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20, color: 'var(--color-accent)' }}>
        Fixtures & Results
      </h1>

      <div style={{ marginBottom: 12, display: 'flex', gap: 4 }}>
        <button
          onClick={() => { setViewMode('all'); setFilterDate(''); }}
          style={{
            padding: '4px 12px',
            borderRadius: 12,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: viewMode === 'all' ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
            color: viewMode === 'all' ? '#fff' : 'var(--color-text-muted)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          All
        </button>
        {['month', 'week', 'day'].map(m => (
          <button
            key={m}
            onClick={() => {
              setViewMode(m);
              if (m === 'day') setFilterDate(dates[0] || '');
              else if (m === 'week') setFilterDate(weeks[0] || '');
              else setFilterDate(months[0] ? months[0] + '-01' : '');
            }}
            style={{
              padding: '4px 12px',
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              background: viewMode === m ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
              color: viewMode === m ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {viewMode !== 'all' && (
      <div style={{ marginBottom: 20, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {viewMode === 'day' && dates.map(d => {
          const dt = new Date(d + 'T12:00:00Z');
          const label = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
          return (
            <button
              key={d}
              onClick={() => setFilterDate(d)}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                background: filterDate === d ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
                color: filterDate === d ? '#fff' : 'var(--color-text)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {label}
            </button>
          );
        })}
        {viewMode === 'week' && weeks.map(w => {
          const isActive = filterDate && filterDate >= w && filterDate < (() => {
            const end = new Date(w + 'T12:00:00Z');
            end.setUTCDate(end.getUTCDate() + 7);
            return end.toISOString().slice(0, 10);
          })();
          return (
            <button
              key={w}
              onClick={() => {
                const start = new Date(w + 'T12:00:00Z');
                setFilterDate(start.toISOString().slice(0, 10));
              }}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                background: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fff' : 'var(--color-text)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {weekLabels[w]}
            </button>
          );
        })}
        {viewMode === 'month' && months.map(m => {
          const isActive = filterDate && filterDate.slice(0, 7) === m;
          return (
            <button
              key={m}
              onClick={() => setFilterDate(m + '-01')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 600,
                background: isActive ? 'var(--color-accent)' : 'rgba(255,255,255,0.04)',
                color: isActive ? '#fff' : 'var(--color-text)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {monthLabels[m]}
            </button>
          );
        })}
      </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {fixtures.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: 40 }}>
            No fixtures found.
          </p>
        ) : (
          (() => {
            const groups = {};
            for (const f of fixtures) {
              const d = f.date.slice(0, 10);
              if (!groups[d]) groups[d] = [];
              groups[d].push(f);
            }
            return Object.entries(groups).map(([dateStr, list]) => {
              const dt = new Date(dateStr + 'T12:00:00Z');
              const label = dt.toLocaleDateString('en-GB', {
                weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                timeZone: 'UTC',
              });
              return (
                <div key={dateStr}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--color-accent)',
                    marginBottom: 8,
                    paddingLeft: 4,
                  }}>
                    {label}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {list.map(f => (
                      <MatchCard
                        key={f.id}
                        fixture={f}
                        homeTeam={teamMap[f.home_team_id]}
                        awayTeam={teamMap[f.away_team_id]}
                        participants={data.participants}
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );
}
