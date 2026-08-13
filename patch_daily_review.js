const fs = require('fs');
let content = fs.readFileSync('src/lib/assistant/daily_review.ts', 'utf8');

const importStatement = "import { buildInsightsContract } from './daily_review_insights';\n";
content = importStatement + content;

const regex = /export async function generateDailyReviewCard\(userId: string\) \{[\s\S]*?return contract;\n\}/;
const newFunction = `export async function generateDailyReviewCard(userId: string) {
  // Use the new deterministic insights builder
  const contract = await buildInsightsContract(userId);
  return contract;
}`;

content = content.replace(regex, newFunction);

fs.writeFileSync('src/lib/assistant/daily_review.ts', content);
