import { useState, useEffect } from 'react';
import { getV2Data } from '../api/client';

const TABS = ['Overview', 'Teams', 'Fixtures', 'Aliases', 'Comparisons'];

function Table({ data, columns }) {
  if (!data || data.length === 0) {
    return <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>No data</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} style={{
                textAlign: 'left', padding: '8px 10px',
                borderBottom: '1px solid var(--color-glass-border)',
                color: 'var(--color-text-muted)', fontWeight: 700, fontSize: 11,
                textTransform: 'uppercase', letterSpacing: '0.05em',
                whiteSpace: 'nowrap',
              }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id || i} style={{
              background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
            }}>
              {columns.map(c => (
                <td key={c.key} style={{
                  padding: '6px 10px',
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  color: 'var(--color-text)',
                  maxWidth: c.maxWidth || 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: c.nowrap ? 'nowrap' : undefined,
                }}>
                  {c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Overview({ counts, syncLog }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
        {Object.entries(counts || {}).map(([key, val]) => (
          <div key={key} className="glass" style={{ padding: '14px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)' }}>{val}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{key}</div>
          </div>
        ))}
      </div>
      {syncLog?.length > 0 && (
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Recent sync log</div>
          <Table data={syncLog} columns={[
            { key: 'provider', label: 'Provider' },
            { key: 'operation', label: 'Operation' },
            { key: 'status', label: 'Status', render: v => (
              <span style={{ color: v === 'ok' ? '#48bb78' : 'var(--token-1)' }}>{v}</span>
            )},
            { key: 'items_count', label: 'Items' },
            { key: 'duration_ms', label: 'Duration', render: v => v ? `${v}ms` : '' },
            { key: 'created_at', label: 'Time', render: v => v ? new Date(v + 'Z').toLocaleString() : '' },
          ]} />
        </div>
      )}
    </div>
  );
}

function TeamsView({ teams, aliases, teamProviderIds }) {
  return (
    <div>
      <div className="glass" style={{ padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Teams ({teams?.length || 0})</div>
        <Table data={teams} columns={[
          { key: 'id', label: 'ID' },
          { key: 'name', label: 'Name', nowrap: true },
          { key: 'code', label: 'Code' },
          { key: 'parent_team_name', label: 'Parent', render: v => v ? <span style={{ color: 'var(--token-3)' }}>{v}</span> : '' },
        ]} />
      </div>

      {aliases?.length > 0 && (
        <div className="glass" style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Name Aliases ({aliases.length})</div>
          <Table data={aliases} columns={[
            { key: 'provider_name', label: 'Provider' },
            { key: 'name', label: 'External Name' },
            { key: 'team_id', label: 'Team ID' },
            { key: 'resolved', label: 'Resolved', render: v => v ? '✓' : '✗' },
          ]} />
        </div>
      )}

      {teamProviderIds?.length > 0 && (
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Provider IDs ({teamProviderIds.length})</div>
          <Table data={teamProviderIds} columns={[
            { key: 'team_id', label: 'Team ID' },
            { key: 'provider_name', label: 'Provider' },
            { key: 'provider_id', label: 'Provider ID' },
          ]} />
        </div>
      )}
    </div>
  );
}

function FixturesView({ fixtures }) {
  const statusColor = (s) => {
    if (s === 'FT' || s === 'COMPLETE') return '#48bb78';
    if (s === 'LIVE' || s === 'IN_PROGRESS') return '#ed8936';
    if (s === 'AWAITING') return '#ecc94b';
    return '#a0aec0';
  };

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Fixtures ({fixtures?.length || 0})</div>
      <Table data={fixtures} columns={[
        { key: 'date', label: 'Date', render: v => v ? new Date(v).toLocaleDateString() : '' },
        { key: 'round', label: 'Round', nowrap: true },
        { key: 'home_team', label: 'Home', nowrap: true },
        { key: 'home_score', label: '', render: (v, row) => (
          <span style={{ fontWeight: 700, fontSize: 14, color: row?.live_status === 'LIVE' ? 'var(--color-accent)' : undefined }}>
            {v ?? '-'}
          </span>
        )},
        { key: 'away_score', label: '', render: (v, row) => (
          <span style={{ fontWeight: 700, fontSize: 14, color: row?.live_status === 'LIVE' ? 'var(--color-accent)' : undefined }}>
            {v ?? '-'}
          </span>
        )},
        { key: 'away_team', label: 'Away', nowrap: true },
        { key: 'live_status', label: 'Status', render: v => (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor(v) }} />
            {v}
          </span>
        )},
        { key: 'current_minute', label: 'Min' },
        { key: 'tv_channel', label: 'TV' },
      ]} />
    </div>
  );
}

function ComparisonsView({ comparisons }) {
  const typeColor = (t) => {
    if (t === 'MATCH') return '#48bb78';
    if (t === 'MISMATCH') return '#ed8936';
    if (t === 'ONLY_V1') return '#4299e1';
    if (t === 'ONLY_V2') return '#9f7aea';
    return '#a0aec0';
  };

  return (
    <div className="glass" style={{ padding: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>Comparison Results ({comparisons?.length || 0})</div>
      <Table data={comparisons} columns={[
        { key: 'entity_type', label: 'Entity' },
        { key: 'diff_type', label: 'Diff', render: v => (
          <span style={{ color: typeColor(v), fontWeight: 700 }}>{v}</span>
        )},
        { key: 'v1_data', label: 'V1 Data', render: v => v ? <code style={{ fontSize: 10, opacity: 0.7 }}>{JSON.stringify(JSON.parse(v)).slice(0, 80)}</code> : '-' },
        { key: 'v2_data', label: 'V2 Data', render: v => v ? <code style={{ fontSize: 10, opacity: 0.7 }}>{JSON.stringify(JSON.parse(v)).slice(0, 80)}</code> : '-' },
      ]} />
    </div>
  );
}

export default function AdminV2DataPage() {
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    getV2Data()
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading V2 data...</div>;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--token-1)', marginBottom: 16 }}>Error</h1>
        <div className="glass" style={{ padding: 20, color: 'var(--token-1)' }}>{error}</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>V2 Data Layer</h1>
        <a href="/admin/dashboard" style={{
          padding: '8px 16px', borderRadius: 8,
          background: 'rgba(255,255,255,0.06)',
          fontSize: 13, fontWeight: 600,
          border: '1px solid rgba(255,255,255,0.08)',
          textDecoration: 'none',
        }}>← Back to Dashboard</a>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 18px', borderRadius: 8,
              background: tab === t ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.06)',
              color: tab === t ? '#fff' : 'var(--color-text)',
              fontWeight: 700, fontSize: 13,
              border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}
          >{t}</button>
        ))}
      </div>

      {tab === 'Overview' && <Overview counts={data.counts} syncLog={data.syncLog} />}
      {tab === 'Teams' && <TeamsView teams={data.teams} aliases={data.aliases} teamProviderIds={data.teamProviderIds} />}
      {tab === 'Fixtures' && <FixturesView fixtures={data.fixtures} />}
      {tab === 'Aliases' && (
        <div className="glass" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: 'var(--color-text)', fontSize: 14 }}>
            Provider IDs ({data.fixtureProviderIds?.length || 0})
          </div>
          <Table data={data.fixtureProviderIds} columns={[
            { key: 'fixture_id', label: 'Fixture ID' },
            { key: 'provider_name', label: 'Provider' },
            { key: 'provider_match_id', label: 'Match ID' },
          ]} />
        </div>
      )}
      {tab === 'Comparisons' && <ComparisonsView comparisons={data.comparisons} />}
    </div>
  );
}
