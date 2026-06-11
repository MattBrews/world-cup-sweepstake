export function calculatePoints(fixture, prediction) {
  const ah = fixture.home_score;
  const aa = fixture.away_score;
  const ph = prediction.home_score;
  const pa = prediction.away_score;

  if (ah === null || aa === null) return null;

  const homeDiff = Math.abs(ah - ph);
  const awayDiff = Math.abs(aa - pa);

  const actualGD = ah - aa;
  const predictedGD = ph - pa;

  let base;
  if (ph === ah && pa === aa) {
    base = 5;
  } else if (actualGD === predictedGD) {
    base = 3;
  } else if ((actualGD > 0 && predictedGD > 0) || (actualGD < 0 && predictedGD < 0) || (actualGD === 0 && predictedGD === 0)) {
    base = 1;
  } else {
    base = 0;
  }

  const bonus = Math.max(0, 3 - (homeDiff + awayDiff));
  return base + bonus;
}

export function recalculateAllPredictions(db) {
  const fixtures = db.prepare(
    "SELECT id, home_score, away_score, status FROM cached_fixtures WHERE status = 'FT'"
  ).all();

  const update = db.prepare(
    'UPDATE predictions SET points = ?, updated_at = datetime(\'now\') WHERE fixture_id = ? AND participant_id = ?'
  );

  const predictions = db.prepare(
    'SELECT id, fixture_id, participant_id, home_score, away_score FROM predictions WHERE fixture_id = ?'
  );

  for (const f of fixtures) {
    const preds = predictions.all(f.id);
    for (const p of preds) {
      const points = calculatePoints(f, p);
      update.run(points, f.id, p.participant_id);
    }
  }
}
