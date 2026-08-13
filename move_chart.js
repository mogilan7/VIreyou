const fs = require('fs');
const file = 'src/components/dashboard/LifestyleDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

// The chart block I injected:
const chartBlockRegex = /\s*{\/\* Тренд ВСР \/ Пульса покоя \(Combo Chart\) \*\/\}[\s\S]*?\s*\}\)\n/;

const match = content.match(chartBlockRegex);
if (match) {
    const chartBlock = match[0];
    content = content.replace(chartBlock, ''); // Remove from old location
    
    // Insert after the HRV/RHR blocks end (around line 532)
    // We look for:
    //               </div>
    //             </div>
    //           </section>
    //           {/* Activity Trend */}

    content = content.replace(
        `              </div>\n            </div>\n          </section>\n\n          {/* Activity Trend */}`,
        `              </div>\n            </div>\n${chartBlock}          </section>\n\n          {/* Activity Trend */}`
    );

    fs.writeFileSync(file, content);
    console.log("Moved chart block successfully.");
} else {
    console.log("Could not find chart block to move.");
}
