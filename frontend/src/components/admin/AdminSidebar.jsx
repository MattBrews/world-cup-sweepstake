import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getSession, logout, triggerSync } from '../../api/client';

export default function AdminSidebar({ currentSweepstake }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getSession().then(s => setSession(s)).catch(() => {});
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  const handleSync = async () => {
    try {
      await triggerSync();
      alert('Sync triggered!');
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  };

  const isActive = (path) => {
    if (path === '/admin/dashboard') {
      return location.pathname === '/admin/dashboard';
    }
    return location.pathname === path;
  };

  const navItems = currentSweepstake ? [
    { label: 'Overview', path: `/admin/${currentSweepstake.slug}`, icon: '📋' },
    { label: 'Settings', path: `/admin/${currentSweepstake.slug}/settings`, icon: '⚙️' },
    { label: 'Participants', path: `/admin/${currentSweepstake.slug}/participants`, icon: '👥' },
  ] : [];

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
          <Link to="/admin/dashboard" style={{ textDecoration: 'none' }} onClick={() => setOpen(false)}>
            <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-accent)' }}>
              Admin
            </div>
          </Link>
        </div>

        {/* Current Sweepstake Info */}
        {currentSweepstake && (
          <div style={{
            marginBottom: 24,
            padding: '12px 16px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
              Managing
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)' }}>
              {currentSweepstake.name}
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => {
            if (item.condition === false) return null;
            return (
              <Link
                key={item.path + item.label}
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

          {/* Quick Actions Section - only show on dashboard */}
          {!currentSweepstake && (
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingLeft: 16 }}>
                Quick Actions
              </div>
              <button
                onClick={() => { handleSync(); setOpen(false); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  padding: '10px 16px',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'transparent',
                  color: 'var(--color-text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s',
                }}
              >
                <span>🔄</span>
                <span>Sync Data</span>
              </button>
            </div>
          )}
        </nav>

        {/* Footer */}
        <div style={{ paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {/* Back Button */}
          {currentSweepstake && (
            <Link
              to="/admin/dashboard"
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
              <span>←</span>
              <span>Back to Sweepstakes</span>
            </Link>
          )}

          {/* Logout */}
          <button
            onClick={() => { handleLogout(); setOpen(false); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '10px 16px',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              background: 'rgba(229,62,62,0.15)',
              color: 'var(--token-1)',
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s',
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </button>
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
