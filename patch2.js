const fs = require('fs');

let content = fs.readFileSync('src/lib/assistant/daily_review_insights.ts', 'utf8');

// Fix explanation_candidates
content = content.replace(
  `  // 6. Explanation Candidates (Late Meal)
  const explanation_candidates = factors
      .filter(f => f.pairs_observed > 0)
      .map(f => {[];
  
  // Late meal logic`,
  `  // 6. Explanation Candidates (Late Meal)
  const explanation_candidates: any[] = [];
  
  // Late meal logic`
);

content = content.replace(
  `  const factors = [lateMealFactor];
  
  const explanation_candidates = factors.map(f => {
      let consistent = null;`,
  `  const factors = [lateMealFactor];
  
  const explanation_candidates = factors
      .filter(f => f.pairs_observed > 0)
      .map(f => {
      let consistent = null;`
);

// Fix relDiff in cooldown
content = content.replace(
  `      if (th && th.mentioned_days_ago < CONFIG.TOPIC_COOLDOWN) {
          const isSpike = d.magnitude_sd >= CONFIG.SPIKE_SD;
          if (d.streak_direction !== 'worsening' && !isSpike) {`,
  `      if (th && th.mentioned_days_ago < CONFIG.TOPIC_COOLDOWN) {
          const relDiff = Math.abs(d.value - d.baseline) / (d.baseline || 1);
          const isSpike = d.magnitude_sd >= CONFIG.SPIKE_SD || relDiff >= 0.15;
          if (d.streak_direction !== 'worsening' && !isSpike) {`
);


fs.writeFileSync('src/lib/assistant/daily_review_insights.ts', content);
