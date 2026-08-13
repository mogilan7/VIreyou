const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/generate.ts', 'utf8');
content = content.replace(/\\`Входные данные \\(JSON контракта\\):\\\\n\\\$\\{jsonStr\\}\\`/g, '\`Входные данные (JSON контракта):\\n\${jsonStr}\`');
content = content.replace(/\\`\\[Safety Checker\\] Attempt \\\$\\{attempts\\} failed due to hallucinated numbers: \\\$\\{check\\.invalidNumbers\\.join\\(', '\\)\\}\\`/g, '\`[Safety Checker] Attempt \${attempts} failed due to hallucinated numbers: \${check.invalidNumbers.join(\\\', \\\')}\`');
fs.writeFileSync('src/lib/assistant/generate.ts', content);
