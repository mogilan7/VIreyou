const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/daily_review.ts', 'utf8');

content = content.replace(/import \{ BASELINE_WINDOW, MIN_BASELINE_POINTS, SPIKE_SD, REPEAT_THRESHOLD \} from "\.\/config";/, `import { CONFIG } from "./config";`);
content = content.replace(/BASELINE_WINDOW/g, 'CONFIG.BASELINE_WINDOW');
content = content.replace(/MIN_BASELINE_POINTS/g, 'CONFIG.MIN_BASELINE_POINTS');
content = content.replace(/SPIKE_SD/g, 'CONFIG.SPIKE_SD');
content = content.replace(/REPEAT_THRESHOLD/g, 'CONFIG.REPEAT_THRESHOLD');
// Need to remove local SPIKE_SD redeclaration which I noticed in grep
content = content.replace(/const CONFIG\.SPIKE_SD = 1\.5;/g, '');

fs.writeFileSync('src/lib/assistant/daily_review.ts', content);
