import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDashboard, getSession } from '../../api/client';
import AdminSidebar from '../../components/admin/AdminSidebar';

export default function AdminSummaryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSession()
      .then(s => {
        if (!s.admin) {
          navigate('/admin');
          return;
        }
        setSession(s);
        return getDashboard(slug);
      })
      .then(d => setData(d))
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  const participantCount = data.participants?.length || 0;
  const completedMatches = data.fixtures?.filter(f => f.status === 'FT').length || 0;
  const totalMatches = data.fixtures?.length || 0;

  return (
    <>
      <AdminSidebar currentSweepstake={data.sweepstake} />
      <div style={{ marginLeft: 240, maxWidth: 960, padding: '24px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>{data.sweepstake.name}</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Overview</div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
          <div className="glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Participants
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)' }}>
              {participantCount}
            </div>
          </div>
          <div className="glass" style={{ padding: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Matches Completed
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)' }}>
              {completedMatches} / {totalMatches}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass" style={{ padding: 20, marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Quick Actions</h2>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link
              to={`/admin/${slug}/settings`}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                color: 'var(--color-text)',
              }}
            >
              ⚙️ Settings
            </Link>
            <Link
              to={`/admin/${slug}/participants`}
              style={{
                padding: '12px 24px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                color: 'var(--color-text)',
              }}
            >
              👥 Participants
            </Link>
            {data.sweepstake?.public_id && (
              <a
                href={`/sweepstake/${data.sweepstake.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '12px 24px',
                  borderRadius: 8,
                  background: 'var(--gradient-accent)',
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                  color: '#fff',
                }}
              >
                🔗 View Public Page
              </a>
            )}
          </div>
        </div>

        {/* Sweepstake Info */}
        <div className="glass" style={{ padding: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Details</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Slug</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{data.sweepstake.slug}</span>
            </div>
            {data.sweepstake?.public_id && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Public ID</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>{data.sweepstake.public_id}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>Created</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                {data.sweepstake.created_at ? new Date(data.sweepstake.created_at.replace(' ', 'T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
