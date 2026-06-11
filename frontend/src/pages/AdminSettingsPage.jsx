import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDashboard, getSession, updateSweepstake } from '../api/client';
import AdminSidebar from '../components/admin/AdminSidebar';

export default function AdminSettingsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [session, setSession] = useState(null);
  const [editSlug, setEditSlug] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [editMsg, setEditMsg] = useState('');
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
      .then(d => {
        setData(d);
        setEditSlug(d.sweepstake.slug);
        setEditName(d.sweepstake.name);
      })
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  return (
    <>
      <AdminSidebar currentSweepstake={data.sweepstake} />
      <div style={{ marginLeft: 240, maxWidth: 960, padding: '24px 16px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>{data.sweepstake.name}</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Settings</div>
        </div>

        {session?.admin && (
          <div className="glass" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Settings</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {session.admin === 'master' && (
                <>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Name</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, outline: 'none' }} />
                      <button onClick={async () => { try { const r = await updateSweepstake(slug, { name: editName }); setEditName(r.name); setEditMsg('Name updated'); } catch (e) { setEditMsg('Error: ' + e.message); } }} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13 }}>Save</button>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Slug</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input value={editSlug} onChange={e => setEditSlug(e.target.value)} style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, outline: 'none' }} />
                      <button onClick={async () => { try { const r = await updateSweepstake(slug, { slug: editSlug }); navigate(`/admin/${r.slug}/settings`, { replace: true }); setEditMsg('Slug updated'); } catch (e) { setEditMsg('Error: ' + e.message); } }} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13 }}>Save</button>
                    </div>
                  </div>
                </>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Admin Password (leave blank to remove)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input type="password" value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="New password" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: 14, outline: 'none' }} />
                  <button onClick={async () => { try { await updateSweepstake(slug, { adminPassword: editPassword }); setEditPassword(''); setEditMsg('Password updated'); } catch (e) { setEditMsg('Error: ' + e.message); } }} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13 }}>Save</button>
                </div>
              </div>
              {data?.sweepstake?.public_id && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>Public Links</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <a href={`/sweepstake/${data.sweepstake.public_id}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: 14 }}>
                      /sweepstake/{data.sweepstake.public_id}
                    </a>
                    {data.sweepstake.slug && (
                      <a href={`/sweepstake/${data.sweepstake.slug}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', fontSize: 14 }}>
                        /sweepstake/{data.sweepstake.slug}
                      </a>
                    )}
                  </div>
                </div>
              )}
              {editMsg && <div style={{ fontSize: 12, color: editMsg.startsWith('Error:') ? 'var(--token-1)' : 'var(--token-7)' }}>{editMsg}</div>}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
