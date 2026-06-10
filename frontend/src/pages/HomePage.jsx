import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getSweepstakes } from '../api/client';

export default function HomePage() {
  const [sweepstakes, setSweepstakes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSweepstakes()
      .then(setSweepstakes)
      .catch(() => setSweepstakes([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 16px' }}>
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.9, display: 'flex', justifyContent: 'center', gap: 8 }}>
          <span>🏆</span>
        </div>
        <h1 style={{
          fontSize: 40,
          fontWeight: 800,
          color: 'var(--color-accent)',
          marginBottom: 8,
          letterSpacing: '-0.02em',
        }}>
          World Cup 2026
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 16 }}>
          Sweepstake Tracker
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</div>
      ) : sweepstakes.length === 0 ? (
        <div className="glass" style={{ textAlign: 'center', padding: 48 }}>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 16, fontSize: 15 }}>
            No sweepstakes yet.
          </p>
          <Link
            to="/admin"
            style={{
              display: 'inline-block',
              padding: '10px 24px',
              background: 'var(--color-accent)',
              color: '#fff',
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            Create One
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sweepstakes.map(s => (
            <Link
              key={s.id}
              to={`/sweepstake/${s.public_id}`}
              className="glass"
              style={{
                padding: '18px 24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'border-color 0.2s',
                borderColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <div>
                <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 2 }}>{s.name}</div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Created {new Date(s.created_at).toLocaleDateString()}
                </div>
              </div>
              <span style={{ color: 'var(--color-accent)', fontSize: 20 }}>→</span>
            </Link>
          ))}
          <Link
            to="/admin"
            style={{
              textAlign: 'center',
              padding: '12px',
              fontSize: 14,
              color: 'var(--color-text-muted)',
              fontWeight: 500,
            }}
          >
            Admin
          </Link>
        </div>
      )}
    </div>
  );
}
