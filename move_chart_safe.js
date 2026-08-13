const fs = require('fs');
const file = 'src/components/dashboard/LifestyleDashboard.tsx';
let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find start and end of chart block
let startIdx = -1;
let endIdx = -1;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Тренд ВСР / Пульса покоя (Combo Chart)')) {
        startIdx = i;
    }
    // The block ends at } ) which is right before Detailed Nutrition
    if (startIdx !== -1 && lines[i].includes('{/* --- Detailed Nutrition --- */}')) {
        // the line before Detailed Nutrition is empty, the one before is `        )}`
        endIdx = i - 2;
        break;
    }
}

if (startIdx !== -1 && endIdx !== -1) {
    const chartLines = lines.splice(startIdx, endIdx - startIdx + 1);
    
    // Now find the target location
    // We want to insert after `</section>` which is before `{/* Activity Trend */}`
    let targetIdx = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('{/* Activity Trend */}')) {
            // we want to insert right before the section that contains Activity Trend
            targetIdx = i - 1; // wait, the section starts at the line before Activity Trend?
            // Actually, `          </section>` is right before `          {/* Activity Trend */}`
            break;
        }
    }
    
    if (targetIdx !== -1) {
        lines.splice(targetIdx, 0, ...chartLines);
        fs.writeFileSync(file, lines.join('\n'));
        console.log("Moved successfully.");
    } else {
        console.log("Could not find target index.");
    }
} else {
    console.log("Could not find chart block boundaries.");
}
