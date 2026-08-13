const fs = require('fs');
const file = 'src/app/[locale]/cabinet/lifestyle/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const calcStr = `
        // SMA Calculation for HRV and RHR
        const hrvTrend: any[] = [];
        const rhrTrend: any[] = [];
        if (sleep14Days && sleep14Days.length > 0) {
            // Group by local date string (YYYY-MM-DD)
            const groupedByDate: Record<string, any> = {};
            sleep14Days.forEach((log: any) => {
                const tzStr = new Date(log.created_at).toLocaleString('en-US', { timeZone: userTz, hour12: false });
                const d = new Date(tzStr);
                const ds = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
                const shortDate = String(d.getDate()).padStart(2,'0') + '.' + String(d.getMonth()+1).padStart(2,'0');
                if (!groupedByDate[ds]) {
                    groupedByDate[ds] = { date: ds, shortDate, hrvs: [], rhrs: [] };
                }
                if (log.hrv) groupedByDate[ds].hrvs.push(log.hrv);
                if (log.resting_heart_rate) groupedByDate[ds].rhrs.push(log.resting_heart_rate);
            });

            // Get last 7 days keys
            const sortedDates = Object.keys(groupedByDate).sort();
            const last7Dates = sortedDates.slice(-7);

            last7Dates.forEach((ds) => {
                const idx = sortedDates.indexOf(ds);
                // get up to 7 previous days including current
                const windowDates = sortedDates.slice(Math.max(0, idx - 6), idx + 1);
                
                let sumHrv = 0, countHrv = 0;
                let sumRhr = 0, countRhr = 0;
                
                windowDates.forEach(wd => {
                    const group = groupedByDate[wd];
                    if (group.hrvs.length) {
                        sumHrv += group.hrvs.reduce((a:number,b:number)=>a+b,0) / group.hrvs.length;
                        countHrv++;
                    }
                    if (group.rhrs.length) {
                        sumRhr += group.rhrs.reduce((a:number,b:number)=>a+b,0) / group.rhrs.length;
                        countRhr++;
                    }
                });

                const group = groupedByDate[ds];
                const avgHrv = group.hrvs.length ? Math.round(group.hrvs.reduce((a:number,b:number)=>a+b,0) / group.hrvs.length) : null;
                const avgRhr = group.rhrs.length ? Math.round(group.rhrs.reduce((a:number,b:number)=>a+b,0) / group.rhrs.length) : null;
                
                if (avgHrv !== null) {
                    hrvTrend.push({
                        date: group.shortDate,
                        value: avgHrv,
                        sma: countHrv > 0 ? Math.round(sumHrv / countHrv) : avgHrv
                    });
                }
                
                if (avgRhr !== null) {
                    rhrTrend.push({
                        date: group.shortDate,
                        value: avgRhr,
                        sma: countRhr > 0 ? Math.round(sumRhr / countRhr) : avgRhr
                    });
                }
            });
        }
`;

content = content.replace(
    `        const data = {`,
    calcStr + `\n        const data = {`
);

content = content.replace(
    `            targetCalories: publicUser?.target_calories || 2200,`,
    `            targetCalories: publicUser?.target_calories || 2200,\n            hrvTrend,\n            rhrTrend,`
);

fs.writeFileSync(file, content);
console.log("Patched SMA logic in page.tsx");
