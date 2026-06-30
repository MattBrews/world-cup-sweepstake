import React, { useState, useEffect, useRef } from 'react';
import { getMatchDetails, getPenaltyShootout } from '../../api/client';

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
  });
}

function goalTypeLabel(t) {
  if (t === 0) return '';
  if (t === 1) return ' (pen)';
  if (t === 3) return ' (OG)';
  if (t === 5) return ' (direct)';
  return '';
}

function tvLabel(channel) {
  if (!channel) return '';
  if (/^BBC/i.test(channel)) return 'BBC';
  if (/^ITV/i.test(channel)) return 'ITV';
  return channel;
}

function TeamHeader({ team, participantName, side }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flex: 1 }}>
      {participantName && (
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-accent)' }}>
          {participantName}
        </span>
      )}
      {team?.logo_url && <img src={team.logo_url} alt="" style={{ width: 36, height: 36 }} />}
      <span
        style={{
          fontSize: 16, fontWeight: 800,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title={team?.name || 'TBD'}
      >
        {team?.name || 'TBD'}
      </span>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: 10, textTransform: 'uppercase' }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function MatchDetailModal({ publicId, matchId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Timeline');
  const loadRef = useRef(false);

  useEffect(() => {
    if (!matchId) return;
    setLoading(true);
    getMatchDetails(publicId, matchId)
      .then(d => { setData(d); setLoading(false); })
      .catch(() => { setData(null); setLoading(false); });

    const interval = setInterval(() => {
      getMatchDetails(publicId, matchId)
        .then(d => setData(d))
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, [publicId, matchId]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    loadRef.current = false;
  }, [matchId]);

  useEffect(() => {
    if (data && !loadRef.current) {
      loadRef.current = true;
      setTab(data.fixture?.home_pen_score != null ? 'Penalties' : 'Timeline');
    }
  }, [data]);

  if (!matchId) return null;

  const fixture = data?.fixture;
  const homeTeam = data?.homeTeam;
  const awayTeam = data?.awayTeam;
  const events = data?.events || [];
  const homeLineup = data?.lineups?.home || [];
  const awayLineup = data?.lineups?.away || [];
  const participants = data?.participants || [];

  const homeParticipant = participants.find(p => Number(p.team_id) === Number(homeTeam?.id));
  const awayParticipant = participants.find(p => Number(p.team_id) === Number(awayTeam?.id));

  const hasPenalties = fixture?.home_pen_score != null;
  const tabList = hasPenalties
    ? ['Penalties', 'Timeline', 'Line-ups', 'Bookings']
    : ['Timeline', 'Line-ups', 'Bookings'];

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
        <div style={{ padding: '20px 20px 0', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              {fixture ? `${shortRound(fixture.stage)}${fixture.stage === 'Group Stage' && fixture.round ? ' · ' + fixture.round : ''}` : ''}
              {fixture && (fixture.status === 'IN_PROGRESS' || fixture.lifecycle_state === 'IN_PROGRESS') && (
                <span style={{ color: 'var(--color-accent)' }}>🔴 LIVE{fixture.current_minute_display ? ` ${fixture.current_minute_display}'` : fixture.current_minute != null ? ` ${fixture.current_minute}'` : ''}</span>
              )}
              {fixture && fixture.status === 'FT' && (
                <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>
                  FT{fixture.home_pen_score != null ? ' (AP)' : ''}
                </span>
              )}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <TeamHeader team={homeTeam} participantName={homeParticipant?.name} side="home" />
                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                  <div>
                    {(fixture.status === 'FT' || fixture.status === 'IN_PROGRESS') && fixture.home_ht_score != null && fixture.away_ht_score != null && (
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, marginBottom: 2 }}>
                        HT: {fixture.home_ht_score} : {fixture.away_ht_score}
                      </div>
                    )}
                    <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-accent)' }}>
                      {fixture.status === 'FT' || fixture.status === 'IN_PROGRESS' || fixture.lifecycle_state === 'IN_PROGRESS'
                        ? `${fixture.home_score ?? '-'} : ${fixture.away_score ?? '-'}`
                        : 'vs'}
                    </div>
                    {fixture.status === 'FT' && fixture.home_pen_score != null && (
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)', fontWeight: 600, marginTop: 2 }}>
                        ({fixture.home_pen_score} : {fixture.away_pen_score})
                      </div>
                    )}
                  </div>
                </div>
                <TeamHeader team={awayTeam} participantName={awayParticipant?.name} side="away" />
              </div>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '8px 24px', fontSize: 12, color: 'var(--color-text-muted)',
                marginBottom: 16, padding: '12px', borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
              }}>
                <DetailRow label="Date" value={fixture && formatDate(fixture.date)} />
                <DetailRow label="Venue" value={fixture?.venue} />
                <DetailRow label="Attendance" value={fixture?.attendance?.toLocaleString()} />
                <DetailRow label="Referee" value={fixture?.referee} />
              </div>

              <div style={{ marginBottom: 8, display: 'flex', gap: 4 }}>
                {tabList.map(t => (
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

        <div style={{ overflowY: 'auto', padding: '0 20px 20px', flex: 1 }}>
          {!loading && data && tab === 'Timeline' && (
            <TimelineTab
              events={events}
              homeTeamId={fixture?.home_team_id}
              awayTeamId={fixture?.away_team_id}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              fixture={fixture}
            />
          )}
          {!loading && data && tab === 'Line-ups' && (
            <LineupsTab homeLineup={homeLineup} awayLineup={awayLineup} homeFormation={fixture?.home_formation} awayFormation={fixture?.away_formation} homeTeam={homeTeam} awayTeam={awayTeam} />
          )}
          {!loading && data && tab === 'Bookings' && (
            <BookingsTab events={events} homeTeamId={fixture?.home_team_id} awayTeamId={fixture?.away_team_id} homeTeam={homeTeam} awayTeam={awayTeam} />
          )}
          {!loading && data && tab === 'Penalties' && (
            <PenaltiesTab slug={publicId} events={events} fixture={fixture} homeTeamId={fixture?.home_team_id} awayTeamId={fixture?.away_team_id} homeTeam={homeTeam} awayTeam={awayTeam} />
          )}
        </div>
      </div>
    </div>
  );
}

function parseMinute(minute) {
  if (!minute) return null;
  const str = String(minute);
  const match = str.match(/^(\d+)'?(?:\+(\d+))?/);
  if (!match) return null;
  const base = parseInt(match[1]);
  const stoppage = match[2] ? parseInt(match[2]) : 0;
  return base + stoppage;
}

function formatMinute(minute) {
  if (minute > 90) {
    return `90+${minute - 90}'`;
  }
  return `${minute}'`;
}

function TransitionRow({ label }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
      <div style={{ flex: 1, height: 1, background: 'var(--color-text-muted)', opacity: 0.3 }} />
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--color-text-muted)', opacity: 0.3 }} />
    </div>
  );
}

function PeriodHeader({ label }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: 1, textTransform: 'uppercase', padding: '8px 0 4px', textAlign: 'center' }}>
      ⬤ {label}
    </div>
  );
}

const CANONICAL_PERIODS = [3, 5, 7, 9];

const PERIOD_LABEL = {
  3: 'First Half',
  4: 'Second Half',
  5: 'Second Half',
  7: 'Extra Time (1st Half)',
  9: 'Extra Time (2nd Half)',
};

const REGULAR_PERIODS = [3, 4, 5];
const ET_PERIODS = [7, 9];

function periodType(p) {
  if (ET_PERIODS.includes(p)) return 'et';
  if (REGULAR_PERIODS.includes(p)) return 'regular';
  return 'other';
}

function TimelineTab({ events, homeTeamId, awayTeamId, homeTeam, awayTeam, fixture }) {
  const matchEvents = events.filter(e => e.minute != null && parseMinute(e.minute) !== null && e.player_name);

  if (matchEvents.length === 0) {
    return <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>No events recorded.</div>;
  }

  // Group valid events by period, sorted within
  const byPeriod = {};
  for (const e of matchEvents) {
    const p = e.period || 3;
    if (!byPeriod[p]) byPeriod[p] = [];
    byPeriod[p].push(e);
  }
  for (const p of Object.keys(byPeriod)) {
    byPeriod[p].sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  }

  const presentPeriods = Object.keys(byPeriod).map(Number).sort((a, b) => a - b);
  const presentSet = new Set(presentPeriods);

  const hasPenScores = fixture?.home_pen_score != null || fixture?.away_pen_score != null;
  const isFT = fixture?.status === 'FT';

  // Determine which canonical periods are known to have finished:
  // A period is finished if a later period has events, or the match is FT/AP
  let lastKnownIdx = -1;
  for (let i = CANONICAL_PERIODS.length - 1; i >= 0; i--) {
    if (presentSet.has(CANONICAL_PERIODS[i])) {
      lastKnownIdx = i;
      break;
    }
  }

  // If FT, at least Second Half (index 1) is finished
  if (isFT && lastKnownIdx < 1) lastKnownIdx = 1;
  // If penalty scores exist, extra time is finished
  if (hasPenScores && lastKnownIdx < 3) lastKnownIdx = 3;

  // Show all canonical periods up to the last known finished one
  const allPeriods = CANONICAL_PERIODS.slice(0, lastKnownIdx + 1);

  function getTransitionLabel(prev, next) {
    const prevType = periodType(prev);
    const nextType = periodType(next);
    if (prevType === 'regular' && nextType === 'regular') return 'Half Time';
    if (prevType === 'regular' && nextType === 'et') return 'End of Full Time';
    if (prevType === 'et' && nextType === 'et') return 'Half Time (Extra Time)';
    return '';
  }

  // Build sections for rendering
  const sections = [];
  for (let i = 0; i < allPeriods.length; i++) {
    const p = allPeriods[i];
    if (i > 0) {
      const label = getTransitionLabel(allPeriods[i - 1], p);
      if (label) sections.push({ type: 'transition', label });
    }
    sections.push({ type: 'header', label: PERIOD_LABEL[p] || `Period ${p}` });
    const evts = byPeriod[p] || [];
    const teamEvts = evts.filter(e => parseInt(e.team_id) === parseInt(homeTeamId) || parseInt(e.team_id) === parseInt(awayTeamId));
    const neutralEvts = evts.filter(e => !e.team_id || (parseInt(e.team_id) !== parseInt(homeTeamId) && parseInt(e.team_id) !== parseInt(awayTeamId)));
    if (teamEvts.length === 0 && neutralEvts.length === 0) {
      sections.push({ type: 'empty' });
    } else {
      if (teamEvts.length > 0) sections.push({ type: 'teamEvents', events: teamEvts });
      if (neutralEvts.length > 0) sections.push({ type: 'neutralEvents', events: neutralEvts });
    }
  }
  // Penalty shootout summary
  if (hasPenScores) {
    sections.push({ type: 'penaltyShootout', label: `Penalty Shootout (${fixture.home_pen_score}-${fixture.away_pen_score})` });
  }
  const lastPeriod = allPeriods[allPeriods.length - 1];
  if (hasPenScores) {
    sections.push({ type: 'transition', label: 'Full Time (After Penalties)' });
  } else if (lastPeriod >= 7) {
    sections.push({ type: 'transition', label: 'End of Extra Time' });
  } else if (lastPeriod >= 3) {
    sections.push({ type: 'transition', label: 'Full Time' });
  }

  // Collect unique minutes within a period for rendering
  function getMinuteGroups(evts) {
    const uniqueMinutes = [...new Set(evts.map(e => parseMinute(e.minute)))];
    uniqueMinutes.sort((a, b) => a - b);
    return uniqueMinutes.map(m => {
      const minuteEvents = evts.filter(e => parseMinute(e.minute) === m);
      return { minute: m, events: minuteEvents };
    });
  }

  function renderMinuteLabel(evts) {
    const raw = evts[0]?.minute;
    if (raw && !/^\d+$/.test(String(raw))) {
      return `${raw}'`;
    }
    return `${parseMinute(evts[0]?.minute)}'`;
  }

  function renderMinuteRow(group) {
    const { minute, events: minuteEvents } = group;
    const homeMinEvents = minuteEvents.filter(e => parseInt(e.team_id) === parseInt(homeTeamId));
    const awayMinEvents = minuteEvents.filter(e => parseInt(e.team_id) === parseInt(awayTeamId));

    return (
      <div key={minute} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          {homeMinEvents.map((e, i) => (
            <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              {renderEventContent(e, 'home')}
            </div>
          ))}
        </div>
        <div style={{ width: 40, textAlign: 'center', fontWeight: 700, color: 'var(--color-text-muted)', fontSize: 12, paddingTop: 4, flexShrink: 0 }}>
          {renderMinuteLabel(minuteEvents)}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
          {awayMinEvents.map((e, i) => (
            <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.02)' }}>
              {renderEventContent(e, 'away')}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>{homeTeam?.name || 'Home'}</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center', padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-accent)' }}>{awayTeam?.name || 'Away'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {sections.map((section, si) => {
          if (section.type === 'transition') {
            return <TransitionRow key={si} label={section.label} />;
          }
          if (section.type === 'header') {
            return <PeriodHeader key={si} label={section.label} />;
          }
          if (section.type === 'empty') {
            return (
              <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-text-muted)', opacity: 0.15 }} />
                <div style={{ width: 40, textAlign: 'center', fontSize: 11, color: 'var(--color-text-muted)', fontStyle: 'italic' }}>No events</div>
                <div style={{ flex: 1, height: 1, background: 'var(--color-text-muted)', opacity: 0.15 }} />
              </div>
            );
          }
          if (section.type === 'penaltyShootout') {
            return (
              <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--color-accent)', opacity: 0.3 }} />
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-accent)', letterSpacing: 1, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{section.label}</div>
                <div style={{ flex: 1, height: 1, background: 'var(--color-accent)', opacity: 0.3 }} />
              </div>
            );
          }
          if (section.type === 'teamEvents') {
            const groups = getMinuteGroups(section.events);
            return (
              <div key={si} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}>
                {groups.map(g => renderMinuteRow(g))}
              </div>
            );
          }
          if (section.type === 'neutralEvents') {
            return (
              <div key={si} style={{ padding: '8px', borderRadius: 8, background: 'rgba(255,255,255,0.02)', marginBottom: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4 }}>Other</div>
                {section.events.sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute)).map((e, i) => (
                  <div key={e.id || i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0' }}>
                    <span style={{ width: 30, fontWeight: 700, color: 'var(--color-text-muted)' }}>{e.minute && !/^\d+$/.test(String(e.minute)) ? `${e.minute}'` : `${parseMinute(e.minute)}'`}</span>
                    {renderEventContent(e, 'neutral')}
                  </div>
                ))}
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function renderEventContent(e, side) {
  if (e.type === 'SUB' && e.additional_info) {
    try {
      const info = JSON.parse(e.additional_info);
      const subContent = (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#E53E3E' }}>↓</span>
            <span style={{ fontWeight: 500 }}>{info.playerOff}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ color: '#48BB78' }}>↑</span>
            <span style={{ fontWeight: 500 }}>{info.playerOn}</span>
          </div>
        </div>
      );
      
      if (side === 'home') {
        return (
          <>
            <div style={{ flex: 1 }}>{subContent}</div>
            <EventIcon type={e.type} info={e.additional_info} />
          </>
        );
      } else {
        return (
          <>
            <EventIcon type={e.type} info={e.additional_info} />
            <div style={{ flex: 1 }}>{subContent}</div>
          </>
        );
      }
    } catch {
      return (
        <>
          <span style={{ fontWeight: 500 }}>{e.player_name}</span>
          <EventIcon type={e.type} info={e.additional_info} />
        </>
      );
    }
  }

  // Non-SUB events
  const detail = renderEventDetail(e);
  if (side === 'home') {
    return (
      <>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{e.player_name}</span>
          {detail}
        </div>
        <EventIcon type={e.type} info={e.additional_info} />
      </>
    );
  } else if (side === 'away') {
    return (
      <>
        <EventIcon type={e.type} info={e.additional_info} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{e.player_name}</span>
          {detail}
        </div>
      </>
    );
  } else {
    // neutral
    return (
      <>
        <EventIcon type={e.type} info={e.additional_info} />
        <span>{e.player_name}</span>
        {detail}
      </>
    );
  }
}

function renderEventDetail(e) {
  if (e.type === 'GOAL' && e.additional_info) {
    try {
      const info = JSON.parse(e.additional_info);
      return (
        <>
          {info.goalType > 0 && <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>{goalTypeLabel(info.goalType)}</span>}
          {info.assist && <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>({info.assist})</span>}
        </>
      );
    } catch { return null; }
  }
  return null;
}

function EventIcon({ type, info }) {
  if (type === 'GOAL') return <span style={{ fontSize: 14, flexShrink: 0 }}>⚽</span>;
  if (type === 'BOOKING') {
    if (!info) return <span style={{ flexShrink: 0, width: 12, height: 18, background: '#EAA623', borderRadius: 2 }} />;
    try {
      const parsed = JSON.parse(info);
      if (parsed.card === 'RED') return <span style={{ flexShrink: 0, width: 12, height: 18, background: '#E53E3E', borderRadius: 2 }} />;
      if (parsed.card === 'SECOND_YELLOW') return <span style={{ flexShrink: 0, display: 'flex', gap: 1 }}><span style={{ width: 5, height: 18, background: '#EAA623', borderRadius: 1 }} /><span style={{ width: 5, height: 18, background: '#E53E3E', borderRadius: 1 }} /></span>;
    } catch {}
    return <span style={{ flexShrink: 0, width: 12, height: 18, background: '#EAA623', borderRadius: 2 }} />;
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

  const homeBookings = bookings.filter(e => parseInt(e.team_id) === parseInt(homeTeamId)).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));
  const awayBookings = bookings.filter(e => parseInt(e.team_id) === parseInt(awayTeamId)).sort((a, b) => parseMinute(a.minute) - parseMinute(b.minute));

  function renderBookingList(list) {
    if (list.length === 0) return <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '4px 0' }}>None</div>;
    return list.map((b, i) => {
      let cardType = 'yellow';
      try {
        const info = JSON.parse(b.additional_info);
        if (info.card === 'RED') cardType = 'red';
        else if (info.card === 'SECOND_YELLOW') cardType = 'secondYellow';
      } catch {}
      return (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, padding: '4px 0' }}>
          <span style={{
            width: 12, height: 16, borderRadius: 2, flexShrink: 0,
            background: cardType === 'red' ? '#E53E3E' : cardType === 'secondYellow' ? 'linear-gradient(to right, #EAA623 50%, #E53E3E 50%)' : '#EAA623',
          }} />
          <span style={{ fontWeight: 600, color: 'var(--color-text-muted)', minWidth: 35 }}>{formatMinute(parseMinute(b.minute))}</span>
          <span style={{ flex: 1 }}>{b.player_name}</span>
        </div>
      );
    });
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)', textAlign: 'center' }}>
          {homeTeam?.name || 'Home'}
        </div>
        {renderBookingList(homeBookings)}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: 'var(--color-accent)', textAlign: 'center' }}>
          {awayTeam?.name || 'Away'}
        </div>
        {renderBookingList(awayBookings)}
      </div>
    </div>
  );
}

function PenaltiesTab({ slug, events, fixture, homeTeamId, awayTeamId, homeTeam, awayTeam }) {
  const [kicks, setKicks] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPenaltyShootout(slug, fixture?.id)
      .then(data => {
        setKicks(data?.kicks || []);
        setLoading(false);
      })
      .catch(() => {
        setKicks([]);
        setLoading(false);
      });
  }, [slug, fixture?.id]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--color-text-muted)', fontSize: 12 }}>Loading...</div>;
  }

  if (kicks && kicks.length > 0) {
    const homeKicks = kicks.filter(k => parseInt(k.team_id) === parseInt(homeTeamId));
    const awayKicks = kicks.filter(k => parseInt(k.team_id) === parseInt(awayTeamId));
    const totalRounds = Math.max(homeKicks.length, awayKicks.length);

    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)' }}>
            {fixture.home_pen_score} - {fixture.away_pen_score}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Penalty Shootout
          </div>
        </div>
        <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
          <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>{homeTeam?.name || 'Home'}</div>
          <div style={{ width: 56, flexShrink: 0, textAlign: 'center' }} />
          <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>{awayTeam?.name || 'Away'}</div>
        </div>
        {Array.from({ length: totalRounds }, (_, i) => {
          const hk = homeKicks[i];
          const ak = awayKicks[i];
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', minHeight: 36,
              borderBottom: i < totalRounds - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
            }}>
              <div style={{ flex: 1, textAlign: 'right', paddingRight: 12, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hk?.player_name || ''}
              </div>
              <div style={{ width: 56, flexShrink: 0, textAlign: 'center', fontSize: 18, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 24 }}>{hk ? (hk.did_score ? '✅' : '❌') : ''}</span>
                <span style={{ width: 24 }}>{ak ? (ak.did_score ? '✅' : '❌') : ''}</span>
              </div>
              <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ak?.player_name || ''}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const pens = events.filter(e => e.period >= 10 && e.type === 'GOAL');
  const homePens = pens.filter(e => parseInt(e.team_id) === parseInt(homeTeamId));
  const awayPens = pens.filter(e => parseInt(e.team_id) === parseInt(awayTeamId));

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)' }}>
          {fixture.home_pen_score ?? '-'} : {fixture.away_pen_score ?? '-'}
        </div>
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Penalty Shootout
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12 }}>
        <div style={{ flex: 1, textAlign: 'right', paddingRight: 12 }}>{homeTeam?.name || 'Home'}</div>
        <div style={{ width: 56, flexShrink: 0, textAlign: 'center' }} />
        <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12 }}>{awayTeam?.name || 'Away'}</div>
      </div>
      {homePens.length === 0 && awayPens.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center', padding: '12px 0' }}>No penalties recorded.</div>
      ) : (
        Array.from({ length: Math.max(homePens.length, awayPens.length) }, (_, i) => {
          const hp = homePens[i];
          const ap = awayPens[i];
          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', minHeight: 36,
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ flex: 1, textAlign: 'right', paddingRight: 12, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {hp?.player_name || ''}
              </div>
              <div style={{ width: 56, flexShrink: 0, textAlign: 'center', fontSize: 18, display: 'flex', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 24 }}>{hp ? '✅' : ''}</span>
                <span style={{ width: 24 }}>{ap ? '✅' : ''}</span>
              </div>
              <div style={{ flex: 1, textAlign: 'left', paddingLeft: 12, fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ap?.player_name || ''}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
