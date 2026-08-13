const fs = require('fs');
const file = 'src/app/[locale]/cabinet/lifestyle/page.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace weekAgo with twoWeeksAgo
content = content.replace(
    `const weekAgo = getTzMidnightUTC(null, -7, false);`,
    `const weekAgo = getTzMidnightUTC(null, -7, false);\n        const twoWeeksAgo = getTzMidnightUTC(null, -14, false);`
);

// Add sleep14Days to Promise.all
content = content.replace(
    `            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),`,
    `            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: weekAgo } }, orderBy: { created_at: 'desc' } }),\n            prisma.sleepLog.findMany({ where: { user_id: userId, created_at: { gte: twoWeeksAgo } }, orderBy: { created_at: 'asc' } }),`
);

content = content.replace(
    `            nutritionWeek, activityWeek, habitsWeek, sleepWeek, hydrationWeek,\n            habitsMonth`,
    `            nutritionWeek, activityWeek, habitsWeek, sleepWeek, hydrationWeek,\n            sleep14Days,\n            habitsMonth`
);

fs.writeFileSync(file, content);
console.log("Patched page.tsx initial queries");
