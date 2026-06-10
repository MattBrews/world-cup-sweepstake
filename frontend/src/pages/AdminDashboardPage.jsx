import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getSweepstakes, createSweepstake, deleteSweepstake, getSession, logout, triggerSync } from '../api/client';

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [sweepstakes, setSweepstakes] = useState([]);
  const [session, setSession] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', slug: '', adminPassword: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then(s => {
        if (s.admin !== 'master') {
          navigate('/admin');
          return;
        }
        setSession(s);
        return getSweepstakes();
      })
      .then(s => setSweepstakes(s))
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await createSweepstake(createForm.name, createForm.slug, createForm.adminPassword || undefined);
      setShowCreate(false);
      setCreateForm({ name: '', slug: '', adminPassword: '' });
      const list = await getSweepstakes();
      setSweepstakes(list);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSync = async () => {
    try {
      await triggerSync();
      alert('Sync triggered!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>Admin Dashboard</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleSync} style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            fontSize: 13,
            fontWeight: 600,
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            Sync Now
          </button>
          <button onClick={handleLogout} style={{
            padding: '8px 16px',
            borderRadius: 8,
            background: 'rgba(229,62,62,0.15)',
            color: 'var(--token-1)',
            fontSize: 13,
            fontWeight: 600,
          }}>
            Logout
          </button>
        </div>
      </div>

      <div className="glass" style={{ padding: 16, marginBottom: 24, fontSize: 13, color: 'var(--color-text-muted)' }}>
        Data source: <strong>openfootball/worldcup.json</strong> (free, no API key required, updated daily)
      </div>

      <button
        onClick={() => setShowCreate(!showCreate)}
        style={{
          padding: '10px 20px',
          borderRadius: 8,
          background: 'var(--color-accent)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          marginBottom: 20,
        }}
      >
        {showCreate ? 'Cancel' : '+ New Sweepstake'}
      </button>

      {showCreate && (
        <form onSubmit={handleCreate} className="glass" style={{ padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            placeholder="Sweepstake Name"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            required
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            placeholder="Slug (URL identifier, e.g. office-pool)"
            value={createForm.slug}
            onChange={e => setCreateForm(f => ({ ...f, slug: e.target.value }))}
            required
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          <input
            placeholder="Admin password (optional — for sweepstake-specific admin)"
            type="password"
            value={createForm.adminPassword}
            onChange={e => setCreateForm(f => ({ ...f, adminPassword: e.target.value }))}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
            }}
          />
          {error && <div style={{ color: 'var(--token-1)', fontSize: 13 }}>{error}</div>}
          <button type="submit" style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'var(--token-7)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
          }}>
            Create
          </button>
        </form>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sweepstakes.map(s => (
          <div key={s.id} className="glass" style={{
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <Link to={`/admin/${s.slug}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1, textDecoration: 'none' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--color-text)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>/sweepstake/{s.slug}</div>
              </div>
              <span style={{ color: 'var(--color-accent)' }}>→</span>
            </Link>
            <button
              onClick={async (e) => {
                e.preventDefault();
                if (window.confirm(`Delete "${s.name}"? This cannot be undone.`)) {
                  try {
                    await deleteSweepstake(s.slug);
                    setSweepstakes(prev => prev.filter(x => x.id !== s.id));
                  } catch (err) {
                    alert('Delete failed: ' + err.message);
                  }
                }
              }}
              style={{
                marginLeft: 12,
                padding: '6px 12px',
                borderRadius: 6,
                background: 'rgba(229,62,62,0.15)',
                color: 'var(--token-1)',
                fontSize: 12,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
