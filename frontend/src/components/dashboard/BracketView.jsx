import { useState, useEffect, useRef } from 'react';

const BRACKET_ROUNDS = [
  { key: 'Round of 32', label: 'R32' },
  { key: 'Round of 16', label: 'R16' },
  { key: 'Quarter-finals', label: 'QF' },
  { key: 'Semi-finals', label: 'SF' },
  { key: '3rd Place', label: '3rd' },
  { key: 'Final', label: 'Final' },
];

const SLIDES = [
  { step: 1, current: 'Round of 32', next: 'Round of 16' },
  { step: 2, current: 'Round of 16', next: 'Quarter-finals' },
  { step: 3, current: 'Quarter-finals', next: 'Semi-finals' },
  { step: 4, current: 'Semi-finals', next: null },
];

function shortRound(key) {
  for (const r of BRACKET_ROUNDS) if (r.key === key) return r.label;
  return key;
}

function buildRoundPositions(allFixtures) {
  const byStage = {};
  for (const f of allFixtures) {
    if (!byStage[f.stage]) byStage[f.stage] = [];
    byStage[f.stage].push(f);
  }
  const pos = {};
  for (const stage of Object.keys(byStage)) {
    const sorted = byStage[stage].sort((a, b) => a.id - b.id);
    sorted.forEach((f, i) => { pos[f.id] = i + 1; });
  }
  return pos;
}

function feederLabel(label, fixtureMap, roundPositions) {
  if (!label || label === 'null') return null;
  if (typeof label !== 'string') return null;
  if (label.startsWith('W')) {
    const fid = parseInt(label.slice(1));
    const feeder = fixtureMap[fid];
    if (feeder) {
      const pos = roundPositions[fid] || '?';
      return `Winner of ${shortRound(feeder.stage)} #${pos}`;
    }
  }
  if (label.startsWith('L')) {
    const fid = parseInt(label.slice(1));
    const feeder = fixtureMap[fid];
    if (feeder) {
      const pos = roundPositions[fid] || '?';
      return `Loser of ${shortRound(feeder.stage)} #${pos}`;
    }
  }
  if (/^\d[A-Z]$/.test(label)) {
    const pos = label[0] === '1' ? 'Winner' : 'Runner-up';
    return `Group ${label[1]} ${pos}`;
  }
  const m = label.match(/^(\d)([A-Z])\/([A-Z/]+)$/);
  if (m) return `Best 3rd (${m[2]}/${m[3]})`;
  return label;
}

function MatchCardSmall({ fixture, homeTeam, awayTeam, teamToParticipant, isFinished, isLive, onClick, homeLabel, awayLabel }) {
  const displayHomeLabel = homeLabel || (fixture.home_team_id === null ? 'TBD' : '?');
  const displayAwayLabel = awayLabel || (fixture.away_team_id === null ? 'TBD' : '?');
  const homeParticipant = teamToParticipant[fixture.home_team_id];
  const awayParticipant = teamToParticipant[fixture.away_team_id];

  return (
    <div
      className="glass bracket-card"
      onClick={onClick && (isFinished || isLive) ? () => onClick(fixture.id) : undefined}
      style={{
        padding: '12px 14px',
        borderLeft: `3px solid ${isFinished ? 'var(--token-7)' : isLive ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)'}`,
        cursor: onClick && (isFinished || isLive) ? 'pointer' : undefined,
        transition: 'transform 0.15s, box-shadow 0.15s',
        width: '100%',
      }}
      onMouseEnter={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)'; } : undefined}
      onMouseLeave={onClick && (isFinished || isLive) ? e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, textAlign: 'right', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6, minWidth: 0 }}>
          {homeTeam?.logo_url && <img src={homeTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <span className="team-name" style={{ fontWeight: homeTeam ? 600 : 400, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: homeTeam ? undefined : 'var(--color-text-muted)', fontStyle: homeTeam ? undefined : 'italic' }} title={displayHomeLabel}>{displayHomeLabel}</span>
            <div className="participant-name" style={{ fontSize: 9, color: homeParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={homeParticipant}>{homeParticipant || '\u00A0'}</div>
          </div>
        </div>

        <div className="score" style={{
          fontWeight: 800,
          fontSize: 14,
          flexShrink: 0,
          textAlign: 'center',
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            {isFinished || isLive ? (fixture.home_score ?? '-') : '-'}:{isFinished || isLive ? (fixture.away_score ?? '-') : '-'}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <span className="team-name" style={{ fontWeight: awayTeam ? 600 : 400, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', color: awayTeam ? undefined : 'var(--color-text-muted)', fontStyle: awayTeam ? undefined : 'italic' }} title={displayAwayLabel}>{displayAwayLabel}</span>
            <div className="participant-name" style={{ fontSize: 9, color: awayParticipant ? 'var(--color-accent)' : 'transparent', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={awayParticipant}>{awayParticipant || '\u00A0'}</div>
          </div>
          {awayTeam?.logo_url && <img src={awayTeam.logo_url} alt="" style={{ width: 18, height: 18, flexShrink: 0 }} />}
        </div>
      </div>
    </div>
  );
}

function PairWithConnector({ match1, match2, targetPairHeight, getTeam, teamToParticipant, fixtureMap, roundPositions, onClick, pairHeight }) {
  const renderMatch = (f) => {
    if (!f) return null;
    const homeTeam = getTeam(f.home_team_id);
    const awayTeam = getTeam(f.away_team_id);
    const isFinished = f.status === 'FT';
    const isLive = f.status === 'IN_PROGRESS' || f.lifecycle_state === 'IN_PROGRESS';
    const hLabel = homeTeam?.name ||
      (f.home_team_id === null ? (feederLabel(f.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
    const aLabel = awayTeam?.name ||
      (f.away_team_id === null ? (feederLabel(f.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
    return (
      <MatchCardSmall
        fixture={f}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        teamToParticipant={teamToParticipant}
        isFinished={isFinished}
        isLive={isLive}
        onClick={onClick}
        homeLabel={hLabel}
        awayLabel={aLabel}
      />
    );
  };

  return (
    <div className="bracket-pair" style={{
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      height: pairHeight,
    }}>
      <div style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', minWidth: 0, width: '55%', height: '100%' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%' }}>{renderMatch(match1)}</div>
        </div>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: '100%' }}>{renderMatch(match2)}</div>
        </div>
      </div>

      <svg className="bracket-connector" style={{ overflow: 'visible', flex: 1, height: '100%', minWidth: 40 }}>
        <line x1="0" y1="25%" x2="40%" y2="25%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="0" y1="75%" x2="40%" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="40%" y1="25%" x2="40%" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        <line x1="40%" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      </svg>
    </div>
  );
}

function RoundColumn({ matches, getTeam, teamToParticipant, fixtureMap, roundPositions, onClick, pairHeight }) {
  const pairs = [];
  for (let i = 0; i < matches.length; i += 2) {
    if (i + 1 < matches.length) {
      pairs.push({ m1: matches[i], m2: matches[i + 1] });
    }
  }

  if (pairs.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--color-text-muted)', fontSize: 13, textAlign: 'center' }}>
        No matches in this round.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {pairs.map((pair, i) => (
        <PairWithConnector
          key={i}
          match1={pair.m1}
          match2={pair.m2}
          getTeam={getTeam}
          teamToParticipant={teamToParticipant}
          fixtureMap={fixtureMap}
          roundPositions={roundPositions}
          onClick={onClick}
          pairHeight={pairHeight}
        />
      ))}
    </div>
  );
}

function FinalSlide({ roundFixtures, getTeam, teamToParticipant, fixtureMap, roundPositions, onClick, sfPairHeight }) {
  const sfMatches = roundFixtures['Semi-finals'] || [];
  const finalMatch = (roundFixtures['Final'] || [])[0];
  const thirdMatch = (roundFixtures['3rd Place'] || [])[0];

  const renderMatch = (f) => {
    if (!f) return null;
    const homeTeam = getTeam(f.home_team_id);
    const awayTeam = getTeam(f.away_team_id);
    const isFinished = f.status === 'FT';
    const isLive = f.status === 'IN_PROGRESS' || f.lifecycle_state === 'IN_PROGRESS';
    const hLabel = homeTeam?.name ||
      (f.home_team_id === null ? (feederLabel(f.home_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
    const aLabel = awayTeam?.name ||
      (f.away_team_id === null ? (feederLabel(f.away_placeholder, fixtureMap, roundPositions) || 'TBD') : '?');
    return (
      <MatchCardSmall
        fixture={f}
        homeTeam={homeTeam}
        awayTeam={awayTeam}
        teamToParticipant={teamToParticipant}
        isFinished={isFinished}
        isLive={isLive}
        onClick={onClick}
        homeLabel={hLabel}
        awayLabel={aLabel}
      />
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: sfPairHeight }}>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 0, height: '100%' }}>
        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          {sfMatches.map((f, i) => (
            <div key={f.id} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%' }}>{renderMatch(f)}</div>
            </div>
          ))}
        </div>

        <svg className="bracket-connector" style={{ overflow: 'visible', flex: '0 0 40px', height: '100%', minWidth: 30, maxWidth: 50 }}>
          <line x1="0" y1="25%" x2="40%" y2="25%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="0" y1="75%" x2="40%" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="40%" y1="25%" x2="40%" y2="75%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <line x1="40%" y1="50%" x2="100%" y2="25%" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
        </svg>

        <div style={{ flex: '1 1 45%', display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-accent)', marginBottom: 2, textAlign: 'center' }}>Final</div>
              {finalMatch && renderMatch(finalMatch)}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '100%' }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 2, textAlign: 'center' }}>3rd Place</div>
              {thirdMatch && renderMatch(thirdMatch)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BracketView({ fixtures, allFixtures = [], teams, participants = [], currentStage, onClick }) {
  const carouselRef = useRef(null);
  const [slidePx, setSlidePx] = useState(0);

  const fixtureMap = {};
  for (const f of allFixtures) fixtureMap[f.id] = f;

  const teamToParticipant = {};
  for (const p of participants) teamToParticipant[p.team_id] = p.name;

  const roundPositions = buildRoundPositions(allFixtures);

  const roundFixtures = {};
  for (const r of BRACKET_ROUNDS) {
    roundFixtures[r.key] = fixtures
      .filter(f => f.stage === r.key)
      .sort((a, b) => a.id - b.id);
  }

  const getTeam = (id) => teams.find(t => t.id === id);

  const numR32Matches = (roundFixtures['Round of 32'] || []).length;
  const numR16Matches = (roundFixtures['Round of 16'] || []).length;
  const numQFMatches = (roundFixtures['Quarter-finals'] || []).length;

  const r32Pairs = Math.max(Math.floor(numR32Matches / 2), 1);
  const r16Pairs = Math.max(Math.floor(numR16Matches / 2), 1);
  const qfPairs = Math.max(Math.floor(numQFMatches / 2), 1);

  const BASE_UNIT = 150;
  const r32PairHeight = BASE_UNIT;
  const r16PairHeight = r32Pairs > 0 && r16Pairs > 0 ? (r32Pairs / r16Pairs) * BASE_UNIT : BASE_UNIT;
  const qfPairHeight = r32Pairs > 0 && qfPairs > 0 ? (r32Pairs / qfPairs) * BASE_UNIT : BASE_UNIT;
  const sfPairHeight = r32Pairs > 0 ? r32Pairs * BASE_UNIT : BASE_UNIT;

  const initialIndex = (() => {
    const idx = SLIDES.findIndex(s => s.current === currentStage || s.next === currentStage);
    return idx >= 0 ? idx : 0;
  })();
  const [activeSlide, setActiveSlide] = useState(initialIndex);

  useEffect(() => {
    const idx = SLIDES.findIndex(s => s.current === currentStage || s.next === currentStage);
    if (idx >= 0) setActiveSlide(idx);
  }, [currentStage]);

  useEffect(() => {
    const measure = () => {
      if (carouselRef.current) {
        const containerW = carouselRef.current.offsetWidth;
        setSlidePx(containerW * 0.8);
      }
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = new ResizeObserver(measure);
    if (carouselRef.current) observer.observe(carouselRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      observer.disconnect();
    };
  }, []);

  const activeDef = SLIDES[activeSlide];
  const totalSlides = SLIDES.length;

  const pairHeightByRound = {
    'Round of 32': r32PairHeight,
    'Round of 16': r16PairHeight,
    'Quarter-finals': qfPairHeight,
    'Semi-finals': sfPairHeight,
  };

  return (
    <div style={{ width: '100%' }}>
      <div className="bracket-carousel-header" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
          Step {activeDef.step} of {totalSlides}:{' '}
          <span style={{ fontWeight: 700 }}>{activeDef.current}</span>
          {activeDef.next && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}→{' '}
              <span style={{ opacity: 0.7 }}>{activeDef.next}</span>
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setActiveSlide(Math.max(0, activeSlide - 1))}
            disabled={activeSlide === 0}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: activeSlide === 0 ? 'var(--color-text-muted)' : 'var(--color-text)',
              cursor: activeSlide === 0 ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              opacity: activeSlide === 0 ? 0.3 : 1,
              flexShrink: 0,
            }}
          >
            ‹
          </button>

          <div style={{ display: 'flex', gap: 5 }}>
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  border: 'none',
                  background: i === activeSlide ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'background 0.2s',
                }}
              />
            ))}
          </div>

          <button
            onClick={() => setActiveSlide(Math.min(totalSlides - 1, activeSlide + 1))}
            disabled={activeSlide === totalSlides - 1}
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: activeSlide === totalSlides - 1 ? 'var(--color-text-muted)' : 'var(--color-text)',
              cursor: activeSlide === totalSlides - 1 ? 'default' : 'pointer',
              fontSize: 14,
              fontWeight: 700,
              opacity: activeSlide === totalSlides - 1 ? 0.3 : 1,
              flexShrink: 0,
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div ref={carouselRef} style={{ position: 'relative', overflow: 'hidden', width: '100%' }}>
        <div style={{
          display: 'flex',
          transition: 'transform 0.4s ease',
          transform: slidePx > 0 ? `translateX(${-activeSlide * slidePx}px)` : undefined,
        }}>
          {SLIDES.map((slide, si) => {
            const isLast = !slide.next;
            const currentMatches = roundFixtures[slide.current] || [];
            const ph = pairHeightByRound[slide.current] || BASE_UNIT;
            return (
              <div key={si} className="bracket-slide" style={{
                flex: '0 0 auto',
                width: slidePx > 0 ? slidePx : `${isLast ? 100 : 80}%`,
                minWidth: 0,
              }}>
                {isLast ? (
                  <FinalSlide
                    roundFixtures={roundFixtures}
                    getTeam={getTeam}
                    teamToParticipant={teamToParticipant}
                    fixtureMap={fixtureMap}
                    roundPositions={roundPositions}
                    onClick={onClick}
                    sfPairHeight={sfPairHeight}
                  />
                ) : (
                  <RoundColumn
                    matches={currentMatches}
                    getTeam={getTeam}
                    teamToParticipant={teamToParticipant}
                    fixtureMap={fixtureMap}
                    roundPositions={roundPositions}
                    onClick={onClick}
                    pairHeight={ph}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
