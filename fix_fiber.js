const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/nutrient_assessment.ts', 'utf8');

// 1. Add fiber to reduce acc
content = content.replace(/kcal: 0, protein: 0, carbs: 0, fat: 0 \}\);/g, 'kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });');
content = content.replace(/kcal: acc.kcal \+ d.kcal,/g, 'kcal: acc.kcal + d.kcal,\n      fiber: acc.fiber + (d.fiber || 0),');

// 2. Define fiberMineralsValue
content = content.replace(/let macrosValue = null;/g, 'let macrosValue = null;\n  let fiberMineralsValue = null;\n  let microsVitaminsValue = null;');

// 3. Set fiberMineralsValue inside the if block
content = content.replace(/macrosValue = \{/g, 'fiberMineralsValue = fiberMineralsSufficient ? { fiber: Math.round(sum.fiber / validDaysCount) } : null;\n    macrosValue = {');

// 4. Update the contract returned object to use fiberMineralsValue instead of "calculated_median"
content = content.replace(/value: fiberMineralsSufficient \? "calculated_median" : null,/g, 'value: fiberMineralsValue,');
content = content.replace(/value: microsVitaminsSufficient \? "calculated_median" : null,/g, 'value: microsVitaminsValue,');

fs.writeFileSync('src/lib/assistant/nutrient_assessment.ts', content);
