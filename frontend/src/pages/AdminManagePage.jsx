import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDashboard, getAdminParticipants, addParticipant, removeParticipant, getSession, logout, updateSweepstake } from '../api/client';

export default function AdminManagePage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [session, setSession] = useState(null);
  const [newName, setNewName] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editSlug, setEditSlug] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editName, setEditName] = useState('');
  const [editMsg, setEditMsg] = useState('');

  useEffect(() => {
    getSession()
      .then(s => {
        if (!s.admin) {
          navigate('/admin');
          return;
        }
        setSession(s);
        return Promise.all([getDashboard(slug), getAdminParticipants(slug)]);
      })
      .then(([d, p]) => {
        setData(d);
        setParticipants(p);
        setEditSlug(d.sweepstake.slug);
        setEditName(d.sweepstake.name);
      })
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const availableTeams = data
    ? data.teams.filter(t => !participants.some(p => p.team_id === t.id))
    : [];

  const isPredictionMode = data?.sweepstake?.mode === 'prediction';

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName) return;
    if (!isPredictionMode && !selectedTeam) return;
    setError('');
    try {
      let result;
      if (isPredictionMode) {
        result = await addParticipant(slug, newName, null, null);
      } else {
        const team = data.teams.find(t => t.id === parseInt(selectedTeam));
        result = await addParticipant(slug, newName, team.id, team.name);
      }
      setParticipants(prev => [...prev, result]);
      setNewName('');
      setSelectedTeam('');
    } catch (err) {
      setError(err.message);
    }
  };

  const [copiedId, setCopiedId] = useState(null);

  const handleRemove = async (participantId) => {
    try {
      await removeParticipant(slug, participantId);
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCopyLink = (link) => {
    navigator.clipboard.writeText(window.location.origin + link);
    setCopiedId(link);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin');
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80, color: 'var(--color-text-muted)' }}>Loading...</div>;
  if (!data) return <div style={{ textAlign: 'center', padding: 80 }}>Not found.</div>;

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>{data.sweepstake.name}</h1>
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Manage Participants</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {session?.admin === 'master' && (
            <button onClick={() => navigate('/admin/dashboard')} style={{
              padding: '8px 16px',
              borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              fontSize: 13,
              fontWeight: 600,
            }}>
              All Sweepstakes
            </button>
          )}
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

      {session?.admin && (
        <div className="glass" style={{ padding: 20, marginBottom: 24 }}>
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
                    <button onClick={async () => { try { const r = await updateSweepstake(slug, { slug: editSlug }); navigate(`/admin/${r.slug}`, { replace: true }); setEditMsg('Slug updated'); } catch (e) { setEditMsg('Error: ' + e.message); } }} style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', fontWeight: 600, fontSize: 13 }}>Save</button>
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

      <form onSubmit={handleAdd} className="glass" style={{ padding: 20, marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Add Participant</h2>

        <input
          placeholder="Person's name"
          value={newName}
          onChange={e => setNewName(e.target.value)}
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

        {!isPredictionMode && (
          <select
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
            required
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              appearance: 'none',
            }}
          >
            <option value="" style={{ background: '#0b111e' }}>Select a team</option>
            {availableTeams.map(t => (
              <option key={t.id} value={t.id} style={{ background: '#0b111e' }}>
                {t.name} ({t.group_letter ? `Group ${t.group_letter}` : 'No group'})
              </option>
            ))}
          </select>
        )}

        {error && <div style={{ color: 'var(--token-1)', fontSize: 13 }}>{error}</div>}

        <button type="submit" style={{
          padding: '10px 20px',
          borderRadius: 8,
          background: 'var(--token-7)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
        }}>
          Add
        </button>

        {!isPredictionMode && availableTeams.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
            All 48 teams have been assigned. No more available.
          </div>
        )}
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {participants.length === 0 ? (
          <div className="glass" style={{ textAlign: 'center', padding: 32, color: 'var(--color-text-muted)' }}>
            No participants yet.
          </div>
        ) : (
          participants.map(p => {
            const team = data.teams.find(t => t.id === p.team_id);
            return (
              <div key={p.id} className="glass" style={{
                padding: '14px 20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                  {!isPredictionMode && team?.logo_url && <img src={team.logo_url} alt="" style={{ width: 24, height: 24, flexShrink: 0 }} />}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    {isPredictionMode ? (
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.link ? (
                          <span style={{ fontSize: 12, color: 'var(--color-accent)', cursor: 'pointer' }} onClick={() => handleCopyLink(p.link)} title="Click to copy prediction link">
                            {copiedId === p.link ? 'Copied!' : 'Copy prediction link'}
                          </span>
                        ) : (
                          'No prediction link'
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        {p.team_name}
                        {team?.group_letter && ` · Group ${team.group_letter}`}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(p.id)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'rgba(229,62,62,0.15)',
                    color: 'var(--token-1)',
                    fontSize: 12,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  Remove
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
