import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function PublicSidebar({ sweepstake, publicId }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const isActive = (path) => {
    if (path === `/sweepstake/${publicId}`) {
      return location.pathname === `/sweepstake/${publicId}`;
    }
    return location.pathname === path;
  };

  const navItems = [
    { label: 'Dashboard', path: `/sweepstake/${publicId}`, icon: '📊' },
    { label: 'Fixtures', path: `/sweepstake/${publicId}/fixtures`, icon: '📅' },
    { label: 'Leaderboard', path: `/sweepstake/${publicId}/stats`, icon: '🏆' },
    { label: 'Participants', path: `/sweepstake/${publicId}/participants`, icon: '👥' },
  ];

  return (
    <>
      {/* Toggle button - only shown when sidebar is closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1001,
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ☰
        </button>
      )}

      {/* Sidebar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 240,
          height: '100vh',
          background: 'rgba(11, 17, 30, 0.95)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
          padding: '24px 16px',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1000,
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.2s ease',
        }}
      >
        {/* Close button */}
        <button
          onClick={() => setOpen(false)}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 40,
            height: 40,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            cursor: 'pointer',
          }}
        >
          ✕
        </button>

        {/* Logo/Brand */}
        <div style={{ marginBottom: 16, paddingLeft: 8 }}>
          <Link to="/" style={{ textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent)' }}>
              World Cup
            </div>
          </Link>
        </div>

        {/* Current Sweepstake Info */}
        {sweepstake && (
          <div style={{
            marginBottom: 24,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Sweepstake
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              {sweepstake.name}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => {
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  background: isActive(item.path) ? 'var(--gradient-accent)' : 'transparent',
                  color: isActive(item.path) ? '#fff' : 'var(--color-text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Admin Link */}
          <Link
            to="/admin"
            onClick={() => setOpen(false)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              textDecoration: 'none',
              background: 'transparent',
              color: 'var(--color-text-muted)',
              marginBottom: 4,
              transition: 'all 0.2s',
            }}
          >
            <span>⚙️</span>
            <span>Admin</span>
          </Link>
        </div>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 999,
          }}
        />
      )}
    </>
  );
}
