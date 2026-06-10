import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(password, slug || undefined);
      if (result.role === 'master') {
        navigate('/admin/dashboard');
      } else {
        navigate(`/admin/${result.slug}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto', padding: '80px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>Admin Login</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginTop: 8 }}>
          Enter the master password or a sweepstake admin password.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="glass" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
            required
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6 }}>
            Sweepstake Slug (optional — leave blank for master admin)
          </label>
          <input
            type="text"
            value={slug}
            onChange={e => setSlug(e.target.value)}
            placeholder="e.g. office-pool"
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 15,
              outline: 'none',
            }}
          />
        </div>

        {error && (
          <div style={{ padding: '8px 12px', background: 'rgba(229,62,62,0.15)', borderRadius: 8, fontSize: 13, color: 'var(--token-1)' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            background: 'var(--gradient-accent)',
            color: '#fff',
            fontWeight: 700,
            fontSize: 15,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}
