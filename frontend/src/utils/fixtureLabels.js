const SHORT_ROUNDS = {
  'Group Stage': 'GS',
  'Round of 32': 'R32',
  'Round of 16': 'R16',
  'Quarter-finals': 'QF',
  'Semi-finals': 'SF',
  '3rd Place': '3rd',
  'Final': 'Final',
};

export function shortRound(key) {
  return SHORT_ROUNDS[key] || key;
}

export function buildRoundPositions(allFixtures) {
  const byStage = {};
  for (const f of allFixtures) {
    if (!byStage[f.stage]) byStage[f.stage] = [];
    byStage[f.stage].push(f);
  }
  const pos = {};
  for (const stage of Object.keys(byStage)) {
    const sorted = byStage[stage].sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach((f, i) => { pos[f.id] = i + 1; });
  }
  return pos;
}

export function feederLabel(label, fixtureMap, roundPositions) {
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
