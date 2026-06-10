import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '80px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🏆</div>
      <h1 style={{
        fontSize: 40,
        fontWeight: 800,
        background: 'var(--gradient-accent)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        marginBottom: 8,
        letterSpacing: '-0.02em',
      }}>
        World Cup 2026
      </h1>
      <p style={{ color: 'var(--color-text-muted)', fontSize: 16, marginBottom: 32 }}>
        Sweepstake Tracker
      </p>
      <Link
        to="/admin"
        style={{
          display: 'inline-block',
          padding: '12px 32px',
          background: 'var(--gradient-accent)',
          color: '#fff',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: 16,
          textDecoration: 'none',
        }}
      >
        Admin Login
      </Link>
    </div>
  );
}
