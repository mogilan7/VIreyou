#!/bin/bash
# Smart watchdog for VIReyou weekly export
# Primary export is executed by Hetzner VPS (cron every Sunday 16:00 UTC = 22:30 Myanmar).
# This Mac script acts as a backup fallback:
# 1. Files on Google Drive are considered fresh if modified no earlier than Sunday 20:00 local time.
# 2. Mac fallback runs ONLY if current time is later than Sunday 23:00 + 3 hours (Monday 02:00) AND fresh files do NOT exist on Drive.

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

function getSundayBounds(now = new Date()) {
    const d = new Date(now);
    const day = d.getDay(); // 0 is Sunday, 1 is Monday...
    const hours = d.getHours();
    let daysBack = day;
    if (day === 0 && hours < 23) {
        daysBack = 7;
    }
    // Sunday 20:00 local time
    const sunday20 = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack, 20, 0, 0, 0);
    // Sunday 23:00 + 3 hours = Monday 02:00 local time
    const cutoffRun = new Date(d.getFullYear(), d.getMonth(), d.getDate() - daysBack, 26, 0, 0, 0);
    return { sunday20, cutoffRun };
}

const { sunday20, cutoffRun } = getSundayBounds();
const now = new Date();

// Check 1: Do NOT run if current time is earlier than Sunday 23:00 + 3 hours (Monday 02:00)
if (now < cutoffRun) {
    console.log("NO");
    process.exit(0);
}

// Check 2: Check if fresh files (>= Sunday 20:00) already exist on Google Drive (uploaded by Hetzner VPS)
const gdriveDir = "/Users/mogilevandrei/Library/CloudStorage/GoogleDrive-mogilev.andrey@gmail.com/Мой диск/VIReyou/VIReyou_Аналитика";
let freshFilesOnDrive = false;

if (fs.existsSync(gdriveDir)) {
    try {
        const files = fs.readdirSync(gdriveDir);
        freshFilesOnDrive = files.some(f => {
            if (!f.endsWith(".csv")) return false;
            try {
                const stat = fs.statSync(path.join(gdriveDir, f));
                return stat.mtime >= sunday20;
            } catch {
                return false;
            }
        });
    } catch {
        freshFilesOnDrive = false;
    }
}

if (freshFilesOnDrive) {
    // Fresh files already on Drive from server
    console.log("NO");
    process.exit(0);
}

// Check 3: Check if Mac has already executed for this cycle
let alreadyRanLocally = false;
if (fs.existsSync(file)) {
    try {
        const lastStr = fs.readFileSync(file, "utf8").trim();
        const lastDate = new Date(lastStr);
        if (!isNaN(lastDate.getTime()) && lastDate >= sunday20) {
            alreadyRanLocally = true;
        }
    } catch {}
}

console.log(alreadyRanLocally ? "NO" : "YES");
' "$LAST_SUCCESS_FILE")

if [ "$SHOULD_RUN" = "YES" ]; then
    echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] Fresh files missing on Drive after Sunday 23:00 + 3h. Running Mac fallback..."
    if "$PROJECT_DIR/scripts/run-export.sh"; then
        node -e 'const fs = require("fs"); fs.writeFileSync(process.argv[1], new Date().toISOString(), "utf8");' "$LAST_SUCCESS_FILE"
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ✅ Fallback export finished successfully. Timestamp updated."
    else
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ❌ Export exited with error. Timestamp NOT updated (will retry next check)."
    fi
else
    # Fresh on Drive or already ran for current cycle or too early
    exit 0
fi
