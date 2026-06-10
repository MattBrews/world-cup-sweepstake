import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDashboard, getParticipants, addParticipant, removeParticipant, getSession, logout } from '../api/client';

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

  useEffect(() => {
    getSession()
      .then(s => {
        if (!s.admin) {
          navigate('/admin');
          return;
        }
        setSession(s);
        return Promise.all([getDashboard(slug), getParticipants(slug)]);
      })
      .then(([d, p]) => {
        setData(d);
        setParticipants(p);
      })
      .catch(() => navigate('/admin'))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  const availableTeams = data
    ? data.teams.filter(t => !participants.some(p => p.team_id === t.id))
    : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName || !selectedTeam) return;
    setError('');
    try {
      const team = data.teams.find(t => t.id === parseInt(selectedTeam));
      const result = await addParticipant(slug, newName, team.id, team.name);
      setParticipants(prev => [...prev, result]);
      setNewName('');
      setSelectedTeam('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRemove = async (participantId) => {
    try {
      await removeParticipant(slug, participantId);
      setParticipants(prev => prev.filter(p => p.id !== participantId));
    } catch (err) {
      setError(err.message);
    }
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

        {availableTeams.length === 0 && (
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {team?.logo_url && <img src={team.logo_url} alt="" style={{ width: 24, height: 24 }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                      {p.team_name}
                      {team?.group_letter && ` · Group ${team.group_letter}`}
                    </div>
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
