import { useState, useEffect } from 'react';
import { getMatchDetails } from '../../api/client';

const TABS = ['Timeline', 'Line-ups', 'Bookings'];

function shortRound(stage) {
  const m = {
    'Group Stage': 'GS', 'Round of 32': 'R32', 'Round of 16': 'R16',
    'Quarter-finals': 'QF', 'Semi-finals': 'SF', '3rd Place': '3rd', 'Final': 'Final',
  };
  return m[stage] || stage;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

function goalTypeLabel(t) {
  if (t === 0) return '';
  if (t === 1) return ' (pen)';
  if (t === 2) return ' (og)';
  if (t === 5) return ' (direct)';
  return '';
}

function tvLabel(channel) {
  if (!channel) return '';
  if (/^BBC/i.test(channel)) return 'BBC';
  if (/^ITV/i.test(channel)) return 'ITV';
  return channel;
}

export default function MatchDetailModal({ publicId, matchId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Timeline');

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    getMatchDetails(publicId, matchId)
      .then(d => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [publicId, matchId]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!matchId) return null;

  const fixture = data?.fixture;
  const homeTeam = data?.homeTeam;
  const awayTeam = data?.awayTeam;
  const events = data?.events || [];
  const homeLineup = data?.lineups?.home || [];
  const awayLineup = data?.lineups?.away || [];

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="glass"
        style={{
          width: '100%', maxWidth: 640, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600 }}>
              {fixture ? `${shortRound(fixture.stage)}${fixture.stage === 'Group Stage' && fixture.round ? ' · ' + fixture.round : ''}` : ''}
            </div>
            <button
              onClick={onClose}
              style={{
                width: 28, height: 28, borderRadius: 14,
                background: 'rgba(255,255,255,0.1)', border: 'none',
                color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              ✕
            </button>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>Loading...</div>
          ) : !data ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>No details available.</div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: 'right' }}>
                  {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 32, height: 32, verticalAlign: 'middle', marginRight: 8 }} />}
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{homeTeam?.name || 'TBD'}</span>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, flexShrink: 0, color: 'var(--color-accent)' }}>
                  {fixture.status === 'FT' ? `${fixture.home_score ?? '-'}:${fixture.away_score ?? '-'}` : 'vs'}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 22, fontWeight: 800 }}>{awayTeam?.name || 'TBD'}</span>
                  {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 32, height: 32, verticalAlign: 'middle', marginLeft: 8 }} />}
                </div>
              </div>

              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                {fixture && formatDate(fixture.date)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {fixture?.venue && <span>{fixture.venue}</span>}
                {fixture?.attendance && <span>Att: {fixture.attendance.toLocaleString()}</span>}
                {fixture?.referee && <span>Ref: {fixture.referee}</span>}
                {tvLabel(fixture?.tv_channel) && <span>{tvLabel(fixture.tv_channel)}</span>}
              </div>

              {/* Formations */}
              {(fixture?.home_formation || fixture?.away_formation) && (
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 12 }}>
                  {fixture.home_formation && <span style={{ marginRight: 16 }}>{homeTeam?.name}: {fixture.home_formation}</span>}
                  {fixture.away_formation && <span>{awayTeam?.name}: {fixture.away_formation}</span>}
                </div>
              )}

              <div style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
                {TABS.map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    style={{
                      flex: 1, padding: '8px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                      background: tab === t ? 'var(--gradient-accent)' : 'rgba(255,255,255,0.04)',
                      color: tab === t ? '#fff' : 'var(--color-text)', border: tab === t ? 'none' : '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Tab content */}
        <div style={{ overflowY: 'auto', padding: '0 20px 20px', flex: 1 }}>
          {!loading && data && tab === 'Timeline' && (
            <TimelineTab events={events} homeTeamId={fixture?.home_team_id} awayTeamId={fixture?.away_team_id} />
          )}
          {!loading && data && tab === 'Line-ups' && (
            <LineupsTab homeLineup={homeLineup} awayLineup={awayLineup} homeFormation={fixture?.home_formation} awayFormation={fixture?.away_formation} homeTeam={homeTeam} awayTeam={awayTeam} />
          )}
          {!loading && data && tab === 'Bookings' && (
            <BookingsTab events={events} homeTeamId={fixture?.home_team_id} awayTeamId={fixture?.away_team_id} homeTeam={homeTeam} awayTeam={awayTeam} />
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineTab({ events, homeTeamId, awayTeamId }) {
  if (events.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No events recorded.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {events.map((e, i) => (
        <div
          key={e.id || i}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', borderRadius: 8,
            background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
            fontSize: 13,
          }}
        >
          <span style={{ width: 40, fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>
            {e.minute || ''}
          </span>
          <EventIcon type={e.type} info={e.additional_info} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontWeight: 500 }}>{e.player_name}</span>
            {e.type === 'GOAL' && e.additional_info && (() => {
              try { const info = JSON.parse(e.additional_info); return info.goalType > 0 ? <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{goalTypeLabel(info.goalType)}</span> : null; } catch { return null; }
            })()}
            {e.type === 'GOAL' && e.additional_info && (() => {
              try { const info = JSON.parse(e.additional_info); return info.assist ? <span style={{ color: 'var(--color-text-muted)', fontSize: 11, marginLeft: 4 }}>(assist: {info.assist})</span> : null; } catch { return null; }
            })()}
            {e.type === 'SUB' && e.additional_info && (() => {
              try { const info = JSON.parse(e.additional_info); return <span style={{ color: 'var(--color-text-muted)', fontSize: 11, display: 'block' }}>{info.playerOn} 🔄 {info.playerOff}</span>; } catch { return null; }
            })()}
          </div>
          {e.team_id && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', flexShrink: 0 }}>
              {parseInt(e.team_id) === parseInt(homeTeamId) ? 'H' : 'A'}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function EventIcon({ type, info }) {
  if (type === 'GOAL') return <span style={{ fontSize: 16, flexShrink: 0 }}>⚽</span>;
  if (type === 'BOOKING') {
    if (!info) return <span style={{ flexShrink: 0, width: 16, height: 22, background: '#EAA623', borderRadius: 2 }} />;
    try {
      const parsed = JSON.parse(info);
      if (parsed.card === 'RED') return <span style={{ flexShrink: 0, width: 16, height: 22, background: '#E53E3E', borderRadius: 2 }} />;
      if (parsed.card === 'SECOND_YELLOW') return <span style={{ flexShrink: 0, display: 'flex', gap: 1 }}><span style={{ width: 7, height: 22, background: '#EAA623', borderRadius: 1 }} /><span style={{ width: 7, height: 22, background: '#E53E3E', borderRadius: 1 }} /></span>;
    } catch {}
    return <span style={{ flexShrink: 0, width: 16, height: 22, background: '#EAA623', borderRadius: 2 }} />;
  }
  if (type === 'SUB') return <span style={{ fontSize: 14, flexShrink: 0 }}>🔄</span>;
  if (type === 'PENALTY') return <span style={{ fontSize: 14, flexShrink: 0 }}>⚫</span>;
  return null;
}

function LineupsTab({ homeLineup, awayLineup, homeFormation, awayFormation, homeTeam, awayTeam }) {
  const homeStarters = homeLineup.filter(p => p.is_starter);
  const homeBench = homeLineup.filter(p => !p.is_starter);
  const awayStarters = awayLineup.filter(p => p.is_starter);
  const awayBench = awayLineup.filter(p => !p.is_starter);

  if (homeLineup.length === 0 && awayLineup.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No line-up data available.</div>;
  }

  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      <div style={{ flex: '1 1 240px' }}>
        <SquadList
          teamName={homeTeam?.name || 'Home'}
          formation={homeFormation}
          starters={homeStarters}
          bench={homeBench}
        />
      </div>
      <div style={{ flex: '1 1 240px' }}>
        <SquadList
          teamName={awayTeam?.name || 'Away'}
          formation={awayFormation}
          starters={awayStarters}
          bench={awayBench}
        />
      </div>
    </div>
  );
}

function SquadList({ teamName, formation, starters, bench }) {
  return (
    <div className="glass" style={{ padding: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)' }}>
        {teamName} {formation ? `(${formation})` : ''}
      </div>
      {starters.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Starting XI</div>
          {starters.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 12 }}>
              <span style={{ width: 22, fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>{p.shirt_number}</span>
              <span style={{ flex: 1 }}>{p.player_name}</span>
              {p.position && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.position}</span>}
            </div>
          ))}
        </>
      )}
      {bench.length > 0 && (
        <>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: 8, marginBottom: 4 }}>Bench</div>
          {bench.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, padding: '2px 0', fontSize: 12 }}>
              <span style={{ width: 22, fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0 }}>{p.shirt_number}</span>
              <span style={{ flex: 1 }}>{p.player_name}</span>
              {p.position && <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{p.position}</span>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function BookingsTab({ events, homeTeamId, awayTeamId, homeTeam, awayTeam }) {
  const bookings = events.filter(e => e.type === 'BOOKING');

  if (bookings.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No bookings.</div>;
  }

  const homeBookings = bookings.filter(e => parseInt(e.team_id) === parseInt(homeTeamId));
  const awayBookings = bookings.filter(e => parseInt(e.team_id) === parseInt(awayTeamId));

  function renderCards(list) {
    const yellows = list.filter(e => {
      try { const info = JSON.parse(e.additional_info); return info.card === 'YELLOW'; } catch { return true; }
    });
    const reds = list.filter(e => {
      try { const info = JSON.parse(e.additional_info); return info.card === 'RED' || info.card === 'SECOND_YELLOW'; } catch { return false; }
    });

    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{'🟨'.repeat(Math.min(yellows.length, 10))}{yellows.length > 10 ? `+${yellows.length - 10}` : ''}</span>
        <span style={{ fontSize: 14 }}>{'🟥'.repeat(Math.min(reds.length, 10))}{reds.length > 10 ? `+${reds.length - 10}` : ''}</span>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{yellows.length}Y {reds.length}R</span>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--color-accent)' }}>{homeTeam?.name || 'Home'}</div>
        {renderCards(homeBookings)}
        {homeBookings.map((b, i) => (
          <div key={i} style={{ fontSize: 13, padding: '2px 0', color: 'var(--color-text-muted)' }}>
            {b.minute && <span style={{ fontWeight: 600, marginRight: 6 }}>{b.minute}</span>}
            {b.player_name}
          </div>
        ))}
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4, color: 'var(--color-accent)' }}>{awayTeam?.name || 'Away'}</div>
        {renderCards(awayBookings)}
        {awayBookings.map((b, i) => (
          <div key={i} style={{ fontSize: 13, padding: '2px 0', color: 'var(--color-text-muted)' }}>
            {b.minute && <span style={{ fontWeight: 600, marginRight: 6 }}>{b.minute}</span>}
            {b.player_name}
          </div>
        ))}
      </div>
    </div>
  );
}
