#!/bin/bash
# Smart watchdog for VIReyou weekly export
# Primary export is executed by Hetzner VPS (cron every Sunday 16:00 UTC).
# This Mac script acts as a backup fallback:
# If files for the latest Sunday cycle are already on Google Drive (uploaded by Hetzner VPS), it does nothing.
# If files are missing, it runs the export on Mac and saves them to Google Drive.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LAST_SUCCESS_FILE="$PROJECT_DIR/scripts/exports/.last_successful_export"
mkdir -p "$PROJECT_DIR/scripts/exports"

# Use Node.js to evaluate cutoff condition with local timezone precision
SHOULD_RUN=$(node -e '
const fs = require("fs");
const path = require("path");
const file = process.argv[1];

function getLastSundayCutoff(now = new Date()) {
    const d = new Date(now);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const hours = d.getHours();
    let daysBack = day;
    if (day === 0 && hours < 23) {
        daysBack = 7;
    }
    // Sunday 23:00 in local system time
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack, 23, 0, 0, 0);
}

const cutoff = getLastSundayCutoff();
let shouldRun = false;

// Check if Sunday export already exists on Google Drive (uploaded by Hetzner VPS)
const gdriveDir = "/Users/mogilevandrei/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика";
let alreadyOnDrive = false;

if (fs.existsSync(gdriveDir)) {
    try {
        const files = fs.readdirSync(gdriveDir);
        alreadyOnDrive = files.some(f => {
            if (!f.endsWith(".csv")) return false;
            try {
                const stat = fs.statSync(path.join(gdriveDir, f));
                return stat.mtime >= cutoff;
            } catch {
                return false;
            }
        });
    } catch {
        alreadyOnDrive = false;
    }
}

if (alreadyOnDrive) {
    // Primary export from server already exists on Drive
    shouldRun = false;
} else if (!fs.existsSync(file)) {
    shouldRun = true;
} else {
    try {
        const lastStr = fs.readFileSync(file, "utf8").trim();
        const lastDate = new Date(lastStr);
        if (isNaN(lastDate.getTime()) || lastDate < cutoff) {
            shouldRun = true;
        }
    } catch {
        shouldRun = true;
    }
}

console.log(shouldRun ? "YES" : "NO");
' "$LAST_SUCCESS_FILE")

if [ "$SHOULD_RUN" = "YES" ]; then
    echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] Export missing on Drive for latest Sunday cycle. Running Mac fallback..."
    if "$PROJECT_DIR/scripts/run-export.sh"; then
        node -e 'const fs = require("fs"); fs.writeFileSync(process.argv[1], new Date().toISOString(), "utf8");' "$LAST_SUCCESS_FILE"
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ✅ Fallback export finished successfully. Timestamp updated."
    else
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ❌ Export exited with error. Timestamp NOT updated (will retry next check)."
    fi
else
    # Already on Drive or already ran for current cycle
    exit 0
fi
