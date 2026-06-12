import { useState, useEffect } from 'react';
import { useParams, Link, useLocation, useSearchParams } from 'react-router-dom';
import { getDashboard, getStats } from '../api/client';
import Toggle from '../components/ui/Toggle';

const STAT_TABS = [
  { key: 'standings', label: 'Standings' },
  { key: 'cards', label: 'Cards' },
  { key: 'goals', label: 'Goals' },
  { key: 'scorers', label: 'Top Scorers' },
];

export default function StatsPage() {
  const { publicId } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);

  const activeTab = searchParams.get('tab') || 'standings';
  const view = searchParams.get('group') || 'team';

  function setTab(tab) {
    const params = { tab };
    if (view !== 'team') params.group = view;
    setSearchParams(params);
  }

  function setView(v) {
    const params = { tab: activeTab };
    if (v !== 'team') params.group = v;
    setSearchParams(params);
  }

  useEffect(() => {
    getDashboard(publicId)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [publicId]);

  useEffect(() => {
    if (!data) return;
    setStatsLoading(true);
    getStats(publicId, activeTab)
      .then(s => setStats(s || []))
      .catch(() => setStats([]))
      .finally(() => setStatsLoading(false));
  }, [publicId, activeTab, data]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const teamMap = {};
  for (const t of data.teams) teamMap[t.id] = t;

  const participants = data.participants;
  const noToggle = activeTab === 'scorers';

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

      <div style={{ marginBottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {STAT_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            style={{
              padding: '6px 16px',
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 600,
              background: activeTab === tab.key ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.04)',
              color: activeTab === tab.key ? '#fff' : 'var(--color-text)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {!noToggle && (
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
      )}

      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : activeTab === 'standings' ? (
        <StandingsView stats={stats} teamMap={teamMap} participants={participants} view={view} />
      ) : activeTab === 'cards' ? (
        <CardsView stats={stats} teamMap={teamMap} participants={participants} view={view} />
      ) : activeTab === 'goals' ? (
        <GoalsView stats={stats} teamMap={teamMap} participants={participants} view={view} />
      ) : activeTab === 'scorers' ? (
        <ScorersView stats={stats} participants={participants} />
      ) : null}
    </div>
  );
}

function groupByPerson(items, participants, teamIdKey = 'team_id') {
  const grouped = {};
  for (const item of items) {
    const pid = item[teamIdKey];
    const person = participants.find(p => p.team_id === pid);
    if (!person) continue;
    if (!grouped[person.name]) grouped[person.name] = { name: person.name, teams: [] };
    grouped[person.name].teams.push(item);
  }
  return Object.values(grouped);
}

function TableHeader({ columns, labels }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '40px 1fr ' + columns,
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
      {(labels || []).map((l, i) => (
        <span key={i} style={{ textAlign: 'center' }}>{l}</span>
      ))}
    </div>
  );
}

function TableRow({ item, i, columns, renderValue, subdued }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr ' + columns,
        gap: 4,
        padding: subdued ? '8px 20px' : '10px 20px',
        fontSize: subdued ? 12 : 14,
        background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
        alignItems: 'center',
      }}
    >
      {subdued ? (
        <span />
      ) : (
        <span style={{ fontWeight: 700, color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{i + 1}</span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {item.logo_url && <img src={item.logo_url} alt="" style={{ width: subdued ? 14 : 20, height: subdued ? 14 : 20, flexShrink: 0 }} />}
        <div>
          <div style={{ fontWeight: subdued ? 400 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
          {item.participant_name && !subdued && (
            <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>{item.participant_name}</div>
          )}
        </div>
      </div>
      {renderValue(item)}
    </div>
  );
}

function AggRow({ item, columns, renderValue, rank, chevron, onClick, alt }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr ' + columns,
        gap: 4,
        padding: '10px 20px',
        fontSize: 14,
        background: alt ? 'transparent' : 'rgba(255,255,255,0.02)',
        alignItems: 'center',
        fontWeight: 700,
        color: 'var(--color-text)',
        cursor: onClick ? 'pointer' : undefined,
        userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 700, color: 'var(--color-text-muted)' }}>{rank || ''}</span>
      <span style={{ color: 'var(--color-text)' }}>
        {chevron ? <span style={{ fontSize: 10, marginRight: 6, color: 'var(--color-text-muted)' }}>{chevron}</span> : null}
        {item.name}
      </span>
      {renderValue(item)}
    </div>
  );
}

function PersonGroup({ person, columns, renderAggValue, renderTeamValue, rowStart, index }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div>
      <AggRow
        item={{ name: person.name, ...person }}
        columns={columns}
        renderValue={renderAggValue}
        rank={index + 1}
        chevron={expanded ? '▼' : '▶'}
        onClick={() => setExpanded(e => !e)}
        alt={index % 2 === 1}
      />
      {expanded && person.teams.map((t, ti) => (
        <TableRow key={ti} item={t} i={rowStart + ti} columns={columns} renderValue={renderTeamValue} subdued />
      ))}
    </div>
  );
}

function renderCell(val, opts = {}) {
  const w = opts.weight || 600;
  if (opts.colored) {
    const n = Number(val);
    return (
      <span style={{ textAlign: 'center', fontWeight: w, color: n > 0 ? 'var(--token-7)' : n < 0 ? 'var(--token-1)' : undefined }}>
        {n > 0 ? `+${n}` : n}
      </span>
    );
  }
  return <span style={{ textAlign: 'center', fontWeight: w }}>{val ?? '-'}</span>;
}

function StandingsView({ stats, teamMap, participants, view }) {
  const teamStats = stats.map(s => {
    const p = participants.find(p => p.team_id === s.team_id);
    return {
      team_id: s.team_id,
      name: teamMap[s.team_id]?.name || `Team #${s.team_id}`,
      logo_url: teamMap[s.team_id]?.logo_url || null,
      participant_name: p?.name || null,
      points: s.points, played: s.played, win: s.win, draw: s.draw, lose: s.lose,
      goal_diff: s.goal_diff, goals_for: s.goals_for, goals_against: s.goals_against,
    };
  });

  const cols = '44px 44px 44px 44px 44px 44px';

  if (view === 'person') {
    const people = groupByPerson(teamStats, participants);
    const ranked = people.map(p => ({
      ...p,
      totalPoints: p.teams.reduce((s, t) => s + t.points, 0),
      totalPlayed: p.teams.reduce((s, t) => s + t.played, 0),
      totalWin: p.teams.reduce((s, t) => s + t.win, 0),
      totalDraw: p.teams.reduce((s, t) => s + t.draw, 0),
      totalLose: p.teams.reduce((s, t) => s + t.lose, 0),
      totalGD: p.teams.reduce((s, t) => s + t.goal_diff, 0),
    })).sort((a, b) => b.totalPoints - a.totalPoints || b.totalGD - a.totalGD);

    let nextRow = 0;
    return (
      <div className="glass" style={{ overflow: 'hidden' }}>
        <TableHeader columns={cols} labels={['Pts', 'Pld', 'W', 'D', 'L', 'GD']} />
        {ranked.length === 0 ? <Empty /> : ranked.map((person, idx) => {
          const start = nextRow;
          nextRow += person.teams.length;
          return (
            <PersonGroup
              key={person.name}
              index={idx}
              person={person}
              columns={cols}
              rowStart={start}
              renderAggValue={item => <>
                {renderCell(item.totalPoints)}{renderCell(item.totalPlayed)}{renderCell(item.totalWin)}{renderCell(item.totalDraw)}{renderCell(item.totalLose)}{renderCell(item.totalGD, { colored: true })}
              </>}
              renderTeamValue={item => <>
                {renderCell(item.points, { weight: 400 })}{renderCell(item.played, { weight: 400 })}{renderCell(item.win, { weight: 400 })}{renderCell(item.draw, { weight: 400 })}{renderCell(item.lose, { weight: 400 })}{renderCell(item.goal_diff, { colored: true, weight: 400 })}
              </>}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <TableHeader columns={cols} labels={['Pts', 'Pld', 'W', 'D', 'L', 'GD']} />
      {teamStats.length === 0 ? <Empty /> : teamStats.map((t, i) => (
        <TableRow key={t.team_id} item={t} i={i} columns={cols} renderValue={item => <>
          {renderCell(item.points)}{renderCell(item.played)}{renderCell(item.win)}{renderCell(item.draw)}{renderCell(item.lose)}{renderCell(item.goal_diff, { colored: true })}
        </>} />
      ))}
    </div>
  );
}

function CardsView({ stats, teamMap, participants, view }) {
  const cardStats = stats.map(s => {
    const p = participants.find(p => p.team_id === s.team_id);
    return {
      team_id: s.team_id,
      name: s.name,
      logo_url: s.logo_url,
      participant_name: p?.name || null,
      yellow: s.yellow || 0,
      red: s.red || 0,
      total: s.total || 0,
    };
  });

  const cols = '44px 44px 44px';

  if (view === 'person') {
    const people = groupByPerson(cardStats, participants);
    const ranked = people.map(p => ({
      ...p,
      totalYellow: p.teams.reduce((s, t) => s + t.yellow, 0),
      totalRed: p.teams.reduce((s, t) => s + t.red, 0),
      totalCards: p.teams.reduce((s, t) => s + t.total, 0),
    })).sort((a, b) => b.totalCards - a.totalCards);

    let nextRow = 0;
    return (
      <div className="glass" style={{ overflow: 'hidden' }}>
        <TableHeader columns={cols} labels={['🟨', '🟥', 'Tot']} />
        {ranked.length === 0 ? <Empty /> : ranked.map((person, idx) => {
          const start = nextRow;
          nextRow += person.teams.length;
          return (
            <PersonGroup
              key={person.name}
              index={idx}
              person={person}
              columns={cols}
              rowStart={start}
              renderAggValue={item => <><span style={{ textAlign: 'center' }}>{item.totalYellow}</span><span style={{ textAlign: 'center' }}>{item.totalRed}</span><span style={{ textAlign: 'center', fontWeight: 700 }}>{item.totalCards}</span></>}
              renderTeamValue={item => <><span style={{ textAlign: 'center', fontWeight: 400 }}>{item.yellow}</span><span style={{ textAlign: 'center', fontWeight: 400 }}>{item.red}</span><span style={{ textAlign: 'center', fontWeight: 500 }}>{item.total}</span></>}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <TableHeader columns={cols} labels={['🟨', '🟥', 'Tot']} />
      {cardStats.length === 0 ? <Empty /> : cardStats.map((t, i) => (
        <TableRow key={t.team_id} item={t} i={i} columns={cols} renderValue={item => <><span style={{ textAlign: 'center' }}>{item.yellow}</span><span style={{ textAlign: 'center' }}>{item.red}</span><span style={{ textAlign: 'center', fontWeight: 700 }}>{item.total}</span></>} />
      ))}
    </div>
  );
}

function GoalsView({ stats, teamMap, participants, view }) {
  const goalsStats = stats.map(s => {
    const p = participants.find(p => p.team_id === s.team_id);
    return {
      team_id: s.team_id,
      name: s.name,
      logo_url: s.logo_url,
      participant_name: p?.name || null,
      gf: s.gf || 0,
      ga: s.ga || 0,
      gd: s.gd || 0,
    };
  });

  const cols = '44px 44px 44px';

  if (view === 'person') {
    const people = groupByPerson(goalsStats, participants);
    const ranked = people.map(p => ({
      ...p,
      totalGF: p.teams.reduce((s, t) => s + t.gf, 0),
      totalGA: p.teams.reduce((s, t) => s + t.ga, 0),
      totalGD: p.teams.reduce((s, t) => s + t.gd, 0),
    })).sort((a, b) => b.totalGF - a.totalGF);

    let nextRow = 0;
    return (
      <div className="glass" style={{ overflow: 'hidden' }}>
        <TableHeader columns={cols} labels={['GF', 'GA', 'GD']} />
        {ranked.length === 0 ? <Empty /> : ranked.map((person, idx) => {
          const start = nextRow;
          nextRow += person.teams.length;
          return (
            <PersonGroup
              key={person.name}
              index={idx}
              person={person}
              columns={cols}
              rowStart={start}
              renderAggValue={item => <>{renderCell(item.totalGF)}{renderCell(item.totalGA)}{renderCell(item.totalGD, { colored: true })}</>}
              renderTeamValue={item => <>{renderCell(item.gf, { weight: 400 })}{renderCell(item.ga, { weight: 400 })}{renderCell(item.gd, { colored: true, weight: 400 })}</>}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <TableHeader columns={cols} labels={['GF', 'GA', 'GD']} />
      {goalsStats.length === 0 ? <Empty /> : goalsStats.map((t, i) => (
        <TableRow key={t.team_id} item={t} i={i} columns={cols} renderValue={item => <>{renderCell(item.gf)}{renderCell(item.ga)}{renderCell(item.gd, { colored: true })}</>} />
      ))}
    </div>
  );
}

function ScorersView({ stats, participants }) {
  const cols = '60px';

  return (
    <div className="glass" style={{ overflow: 'hidden' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '40px 1fr ' + cols,
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
        <span>Player</span>
        <span style={{ textAlign: 'center' }}>Goals</span>
      </div>
      {stats.length === 0 ? <Empty /> : stats.map((s, i) => {
        const participant = participants.find(p => p.team_id === s.team_id);
        return (
          <div
            key={`${s.player_name}-${s.team_id}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr ' + cols,
              gap: 4,
              padding: '10px 20px',
              fontSize: 14,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 700, color: i < 3 ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>{i + 1}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{s.player_name}</span>
                {s.logo_url && <img src={s.logo_url} alt="" style={{ width: 14, height: 14, marginLeft: 2 }} />}
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{s.team_name}</span>
              </div>
              {participant && (
                <div style={{ fontSize: 11, color: 'var(--color-accent)', fontWeight: 500 }}>
                  {participant.name}
                </div>
              )}
            </div>
            <span style={{ textAlign: 'center', fontWeight: 700 }}>{s.goals}</span>
          </div>
        );
      })}
    </div>
  );
}

function Empty() {
  return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No data available.</div>;
}
