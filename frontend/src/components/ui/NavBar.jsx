import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    const handler = e => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function NavBar({ navPages }) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  if (isMobile) return (
    <div style={{ marginBottom: 24, position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '10px 16px',
          borderRadius: 12,
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: 'var(--color-text)',
        }}
      >
        <span>{navPages.find(p => location.pathname === p.path)?.label || 'Menu'}</span>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{open ? '✕' : '☰'}</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          borderRadius: 12,
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.04)',
          backdropFilter: 'blur(8px)',
          overflow: 'hidden',
          zIndex: 100,
        }}>
          {navPages.map(p => {
            const isActive = location.pathname === p.path;
            return (
              <Link
                key={p.label}
                to={p.path}
                style={{
                  display: 'block',
                  padding: '12px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: isActive ? 'var(--gradient-accent)' : 'transparent',
                  color: isActive ? '#fff' : 'var(--color-text)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {p.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
      {navPages.map(p => {
        const isActive = location.pathname === p.path;
        return (
          <Link
            key={p.label}
            to={p.path}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              textAlign: 'center',
              whiteSpace: 'nowrap',
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
  );
}
