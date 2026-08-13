const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/nutrient_assessment.ts', 'utf8');

content = content.replace(/import \{[\s\S]*?\} from "\.\/config";/, `import { CONFIG } from "./config";\n\nconst WEEKDAY_SKEW_THRESHOLD = 0.2;\nconst STALENESS_DAYS = 3;`);
content = content.replace(/MIN_KCAL_FALLBACK/g, 'CONFIG.MIN_KCAL_FALLBACK');
content = content.replace(/MIN_EI_BMR_RATIO/g, 'CONFIG.MIN_EI_BMR_RATIO');
content = content.replace(/MIN_MEALS_PER_DAY/g, 'CONFIG.MIN_MEALS_PER_DAY');
content = content.replace(/MAX_KCAL_PER_DAY/g, 'CONFIG.MAX_KCAL_PER_DAY');
content = content.replace(/GATING\.MACROS/g, 'CONFIG.THRESHOLD_MACRO');
content = content.replace(/GATING\.FIBER_MINERALS/g, 'CONFIG.THRESHOLD_MINERALS');
content = content.replace(/GATING\.MICROS_VITAMINS/g, 'CONFIG.THRESHOLD_MICRO');

fs.writeFileSync('src/lib/assistant/nutrient_assessment.ts', content);
