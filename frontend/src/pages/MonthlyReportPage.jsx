import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMonthlyReport } from '../api/client';

const STAGE_LABELS = {
  'Group Stage': 'Group Stage',
  'Round of 32': 'Round of 32',
  'Round of 16': 'Round of 16',
  'Quarter-finals': 'Quarter-finals',
  'Semi-finals': 'Semi-finals',
  '3rd Place': '3rd Place Play-off',
  'Final': 'Final',
};

const STATUS_CONFIG = {
  qualified: { label: 'Qualified', color: '#68d391', bg: 'rgba(56,161,105,0.12)' },
  atRisk: { label: 'In Contention', color: '#f6ad55', bg: 'rgba(237,137,54,0.12)' },
  eliminated: { label: 'Eliminated', color: '#fc8181', bg: 'rgba(229,62,62,0.12)' },
};

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function getRankColor(rank) {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return 'var(--color-text-muted)';
}

function StatusBadge({ status, small }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.atRisk;
  return (
    <span style={{
      fontSize: small ? 9 : 10,
      fontWeight: 700,
      padding: small ? '2px 6px' : '3px 10px',
      borderRadius: 4,
      background: cfg.bg,
      color: cfg.color,
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  );
}

function Section({ title, children, accent }) {
  return (
    <div className="glass" style={{
      padding: '20px 24px',
      marginBottom: 16,
      borderTop: accent ? '3px solid var(--color-accent)' : undefined,
    }}>
      <h2 style={{
        fontSize: 13,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        color: accent ? 'var(--color-accent)' : 'var(--color-text-muted)',
        marginBottom: 16,
      }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>
      {message || 'No data available.'}
    </div>
  );
}

export default function MonthlyReportPage() {
  const { publicId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getMonthlyReport(publicId)
      .then(setReport)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [publicId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', textAlign: 'center', paddingTop: 80, color: 'var(--color-text-muted)' }}>
        Loading report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', textAlign: 'center', paddingTop: 80 }}>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: 16 }}>{error || 'Report not found.'}</p>
        <Link to={`/sweepstake/${publicId}`} style={{ color: 'var(--color-accent)' }}>Back to Dashboard</Link>
      </div>
    );
  }

  const stageLabel = STAGE_LABELS[report.currentStage] || report.currentStage;
  const progress = report.stageProgress?.[report.currentStage];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link to={`/sweepstake/${publicId}`} style={{
          fontSize: 12, color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: 8, display: 'inline-block',
        }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{
          fontSize: 28, fontWeight: 800,
          background: 'var(--gradient-accent)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 4,
        }}>
          Monthly Report
        </h1>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            {report.sweepstake.name} &middot; {formatDate(report.generatedAt)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
            background: 'var(--gradient-accent)', color: '#fff',
          }}>
            {stageLabel}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
            <span>Progress: {progress.completed}/{progress.total} matches played</span>
            <span>{Math.round(progress.completed / progress.total * 100)}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: 'var(--gradient-accent)',
              width: `${progress.completed / progress.total * 100}%`,
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 16 }}>
        <StatCard label="Participants" value={report.stats.totalParticipants} />
        <StatCard label="Still Alive" value={report.stats.stillAlive} color="#68d391" />
        <StatCard label="Eliminated" value={report.stats.eliminated} color="#fc8181" />
        <StatCard label="Total Groups" value={report.groupSnapshot.length} />
      </div>

      {/* Leaderboard */}
      <Section title="Leaderboard" accent>
        {report.participantStandings.length === 0 ? (
          <EmptyState message="No participants assigned yet." />
        ) : (
          <div>
            {report.participantStandings.map((person, i) => (
              <div key={person.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 0',
                borderBottom: i < report.participantStandings.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
              }}>
                <span style={{
                  width: 24, fontWeight: 700, fontSize: 14,
                  color: getRankColor(person.rank),
                  textAlign: 'center',
                }}>
                  {person.rank}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{person.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 1 }}>
                    {person.teams.map(t => t.team_name).join(', ')}
                  </div>
                </div>
                <span style={{
                  fontSize: 20, fontWeight: 800, color: 'var(--color-accent)',
                }}>
                  {person.totalPoints}
                </span>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: -4 }}>pts</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Tournament Status */}
      {(report.teamStatusByPerson.qualified.length > 0 ||
        report.teamStatusByPerson.atRisk.length > 0 ||
        report.teamStatusByPerson.eliminated.length > 0) && (
        <Section title="Tournament Status" accent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            <StatusColumn title="Qualified" status="qualified" people={report.teamStatusByPerson.qualified} />
            <StatusColumn title="In Contention" status="atRisk" people={report.teamStatusByPerson.atRisk} />
            <StatusColumn title="Eliminated" status="eliminated" people={report.teamStatusByPerson.eliminated} />
          </div>
        </Section>
      )}

      {/* Group Standings */}
      {!report.isKnockout && report.groupSnapshot.length > 0 && (
        <Section title="Group Standings" accent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {report.groupSnapshot.map(group => (
              <div key={group.group} style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.05em', color: 'var(--color-text-muted)',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  Group {group.group}
                </div>
                {group.teams.map(team => (
                  <div key={team.team_id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', fontSize: 12,
                    background: team.participants.length > 0 ? 'rgba(56,161,105,0.04)' : undefined,
                    opacity: team.status === 'eliminated' ? 0.5 : 1,
                  }}>
                    <span style={{ width: 16, fontWeight: 700, color: getRankColor(team.rank), textAlign: 'center', fontSize: 11 }}>
                      {team.rank}
                    </span>
                    {team.logo_url && <img src={team.logo_url} alt="" style={{ width: 14, height: 14 }} />}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontWeight: team.participants.length > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {team.team_name}
                      </span>
                      {team.participants.length > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)', fontWeight: 500 }}>
                          {team.participants.join(', ')}
                        </span>
                      )}
                    </div>
                    <StatusBadge status={team.status} small />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Knockout Progress */}
      {report.isKnockout && report.knockoutProgress && (
        <Section title="Knockout Progress" accent>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {Object.entries(report.knockoutProgress).map(([round, data]) => (
              <div key={round} style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '12px 16px',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                  {round}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-accent)' }}>
                  {data.completed}/{data.total}
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 2,
                    background: 'var(--gradient-accent)',
                    width: `${data.total > 0 ? data.completed / data.total * 100 : 0}%`,
                  }} />
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Highlights row: Biggest Wins + Top Scorers + Card Kings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 16 }}>
        {/* Biggest Wins */}
        <div className="glass" style={{ padding: '20px 24px' }}>
          <h3 style={{
            fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--color-text-muted)', marginBottom: 12,
          }}>
            Biggest Wins
          </h3>
          {report.biggestWins.length === 0 ? (
            <EmptyState message="No completed matches yet." />
          ) : (
            report.biggestWins.map((win, i) => (
              <div key={win.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                borderBottom: i < report.biggestWins.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
                fontSize: 12,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {win.home_logo && <img src={win.home_logo} alt="" style={{ width: 14, height: 14 }} />}
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {win.home_team_name}
                    </span>
                  </div>
                  {win.home_participants.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {win.home_participants.join(', ')}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 800, color: 'var(--color-accent)' }}>
                  {win.home_score}-{win.away_score}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {win.away_team_name}
                    </span>
                    {win.away_logo && <img src={win.away_logo} alt="" style={{ width: 14, height: 14 }} />}
                  </div>
                  {win.away_participants.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)', textAlign: 'right' }}>
                      {win.away_participants.join(', ')}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Top Scorers */}
        <div className="glass" style={{ padding: '20px 24px' }}>
          <h3 style={{
            fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--color-text-muted)', marginBottom: 12,
          }}>
            Top Scorers
          </h3>
          {report.topScorers.length === 0 ? (
            <EmptyState message="No goals scored yet." />
          ) : (
            report.topScorers.map((scorer, i) => (
              <div key={`${scorer.player_name}-${scorer.team_id}`} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', fontSize: 12,
                borderBottom: i < report.topScorers.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
              }}>
                <span style={{ width: 16, fontWeight: 700, color: getRankColor(i + 1), textAlign: 'center', fontSize: 11 }}>
                  {i + 1}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {scorer.player_name}
                    </span>
                    {scorer.logo_url && <img src={scorer.logo_url} alt="" style={{ width: 14, height: 14 }} />}
                  </div>
                  {scorer.participants.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {scorer.participants.join(', ')}
                    </span>
                  )}
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-accent)' }}>
                  {scorer.goals}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Card Kings */}
        <div className="glass" style={{ padding: '20px 24px' }}>
          <h3 style={{
            fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
            color: 'var(--color-text-muted)', marginBottom: 12,
          }}>
            Card Kings
          </h3>
          {report.cardLeaders.length === 0 ? (
            <EmptyState message="No cards issued yet." />
          ) : (
            report.cardLeaders.map((card, i) => (
              <div key={card.team_id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 0', fontSize: 12,
                borderBottom: i < report.cardLeaders.length - 1 ? '1px solid rgba(255,255,255,0.04)' : undefined,
              }}>
                {card.logo_url && <img src={card.logo_url} alt="" style={{ width: 14, height: 14 }} />}
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {card.name}
                  </span>
                  {card.participants.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                      {card.participants.join(', ')}
                    </span>
                  )}
                </div>
                <span style={{ color: '#ecc94b', fontWeight: 600 }}>{card.yellow}Y</span>
                <span style={{ color: '#fc8181', fontWeight: 600, marginRight: 4 }}>{card.red}R</span>
                <span style={{ fontWeight: 800, color: 'var(--color-accent)', fontSize: 14 }}>{card.total}</span>
              </div>
            ))
          )}
        </div>
      </div>


    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="glass" style={{ padding: '16px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: color || 'var(--color-accent)' }}>
        {value}
      </div>
    </div>
  );
}

function StatusColumn({ title, status, people }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <div style={{
      background: `linear-gradient(135deg, ${cfg.bg} 0%, rgba(255,255,255,0.02) 100%)`,
      borderRadius: 8, padding: '14px 16px',
      border: `1px solid ${cfg.bg}`,
    }}>
      <h3 style={{
        fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
        color: cfg.color, marginBottom: 10,
      }}>
        {title} ({people.length})
      </h3>
      {people.length === 0 ? (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>None</p>
      ) : (
        people.map(person => (
          <div key={person.name} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{person.name}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {person.teams.map(team => (
                <span key={team.team_id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  background: 'rgba(255,255,255,0.04)',
                }}>
                  {team.logo_url && <img src={team.logo_url} alt="" style={{ width: 10, height: 10 }} />}
                  {team.team_name}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}


