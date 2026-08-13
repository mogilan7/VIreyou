const fs = require('fs');
const file = 'src/components/dashboard/LifestyleDashboard.tsx';
let content = fs.readFileSync(file, 'utf8');

const chartBlockRegex = /        {\/\* Тренд ВСР \/ Пульса покоя \(Combo Chart\) \*\/\}[\s\S]*?\s*\}\)\n/;

const match = content.match(chartBlockRegex);
if (match) {
    const chartBlock = match[0];
    content = content.replace(chartBlock, ''); // Remove from old location
    
    // The target is the end of the Sleep Detailed section:
    //               </div>
    //             </div>
    //           </section>
    
    // we want to place it right after `</section>` of sleep detailed.
    content = content.replace(
        `              </div>\n            </div>\n          </section>\n\n          {/* Activity Trend */}`,
        `              </div>\n            </div>\n          </section>\n\n${chartBlock}\n          {/* Activity Trend */}`
    );

    fs.writeFileSync(file, content);
    console.log("Moved chart block successfully.");
} else {
    console.log("Could not find chart block to move.");
}
