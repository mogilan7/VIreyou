const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/generate.ts', 'utf8');
const newPrompt = fs.readFileSync('new_prompt.txt', 'utf8');

const regex = /const DAILY_REVIEW_PROMPT = `[\s\S]*?`;/;
content = content.replace(regex, 'const DAILY_REVIEW_PROMPT = `' + newPrompt + '`;');

fs.writeFileSync('src/lib/assistant/generate.ts', content);
