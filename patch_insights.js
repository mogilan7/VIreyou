const fs = require('fs');

let content = fs.readFileSync('src/lib/assistant/daily_review_insights.ts', 'utf8');

// 1. Add relative difference check to checkDev
content = content.replace(
  'if (mag > CONFIG.SPIKE_SD || streak >= CONFIG.REPEAT_THRESHOLD) {',
  `const relDiff = Math.abs(diff) / b.median;
      if (mag > CONFIG.SPIKE_SD || streak >= CONFIG.REPEAT_THRESHOLD || relDiff >= 0.1) {`
);

// 2. Update trend_7d calculation and rounding
content = content.replace(
  `      if (recent.length && prev.length) {
          const recMed = calculateMedian(recent);
          const prevMed = calculateMedian(prev);
          if (Math.abs(recMed - prevMed) > baselines[m].sd * 0.5) {
              trend = recMed > prevMed ? "improving" : "worsening";
          }
      }`,
  `      if (recent.length && baselines[m]) {
          const recMed = calculateMedian(recent);
          const bMed = baselines[m].median;
          // Compare recent 7 days to the 14-day baseline
          if (recMed > bMed * 1.05) trend = "improving";
          else if (recMed < bMed * 0.95) trend = "worsening";
      }`
);

// Add Math.round(val) to val
content = content.replace(
  '      let val = targetData[m] || 0;',
  '      let val = Math.round(targetData[m] || 0);'
);


// 3. Normalize topic_history keys
content = content.replace(
  '      if (!mentionsByTopic[m.topic_key]) mentionsByTopic[m.topic_key] = [];',
  `      const baseTopic = m.topic_key.split('_')[0];
      if (!mentionsByTopic[baseTopic]) mentionsByTopic[baseTopic] = [];`
);
content = content.replace(
  '      mentionsByTopic[m.topic_key].push(m);',
  '      mentionsByTopic[baseTopic].push(m);'
);

content = content.replace(
  '      const th = topic_history[d.metric];',
  '      const baseTopic = d.metric.split(\\'_\\')[0];\n      const th = topic_history[baseTopic];'
);


// 4. Update Praise logic
content = content.replace(
  `      const normalDomains = Object.keys(domain_states).filter(k => 
          domain_states[k].status === 'normal' && 
          (domain_states[k].trend_7d === 'stable' || domain_states[k].trend_7d === 'improving')
      );
      if (normalDomains.length > 0) {
                if (normalDomains.length > 0) {
          const dom = normalDomains[0];
          // Find the metric matching the domain
          const metricKey = metrics.find(m => m.startsWith(dom)) || dom;
          let val = targetData[metricKey] || 0;
          let bVal = baselines[metricKey]?.median || 0;
          let formattedVal = metricKey === 'sleep_duration' ? formatMinutes(val) : undefined;
          let formattedBaseline = metricKey === 'sleep_duration' ? formatMinutes(bVal) : undefined;
          
          praise = { 
              metric: dom, 
              value: Math.round(val), 
              baseline: Math.round(bVal),
              reason: 'maintenance',
              ...(formattedVal && { value_formatted: formattedVal }),
              ...(formattedBaseline && { baseline_formatted: formattedBaseline })
          };
      }
      }`,
  `      // Find domains that are normal and not dropping below baseline by more than 5%
      const candidateDomains = Object.keys(domain_states).filter(k => {
          if (domain_states[k].status !== 'normal') return false;
          const metricKey = metrics.find(m => m.startsWith(k)) || k;
          const val = targetData[metricKey] || 0;
          const bVal = baselines[metricKey]?.median || 0;
          // Must not be more than 5% below baseline
          return val >= bVal * 0.95;
      });
      
      // Sort candidates: 'improving' first, then 'stable', ignore 'worsening'
      candidateDomains.sort((a, b) => {
          if (domain_states[a].trend_7d === 'improving' && domain_states[b].trend_7d !== 'improving') return -1;
          if (domain_states[b].trend_7d === 'improving' && domain_states[a].trend_7d !== 'improving') return 1;
          return 0;
      });

      if (candidateDomains.length > 0) {
          const dom = candidateDomains[0];
          const metricKey = metrics.find(m => m.startsWith(dom)) || dom;
          let val = Math.round(targetData[metricKey] || 0);
          let bVal = baselines[metricKey]?.median || 0;
          let formattedVal = metricKey === 'sleep_duration' ? formatMinutes(val) : undefined;
          let formattedBaseline = metricKey === 'sleep_duration' ? formatMinutes(bVal) : undefined;
          
          praise = { 
              metric: dom, 
              value: Math.round(val), 
              baseline: Math.round(bVal),
              reason: 'maintenance',
              ...(formattedVal && { value_formatted: formattedVal }),
              ...(formattedBaseline && { baseline_formatted: formattedBaseline })
          };
      }`
);

fs.writeFileSync('src/lib/assistant/daily_review_insights.ts', content);
