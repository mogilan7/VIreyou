#!/bin/bash
# Smart watchdog for VIReyou weekly export
# Checks if the export has run for the most recent Sunday 23:00 Myanmar cutoff (16:30 UTC).
# If not (e.g. Mac was asleep or turned off), runs it and saves timestamp ONLY on exit code 0.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LAST_SUCCESS_FILE="$PROJECT_DIR/scripts/exports/.last_successful_export"
mkdir -p "$PROJECT_DIR/scripts/exports"

# Use Node.js to evaluate cutoff condition with timezone precision
SHOULD_RUN=$(node -e '
const fs = require("fs");
const file = process.argv[1];

function getLastSundayCutoff(now = new Date()) {
    const d = new Date(now);
    const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const hours = d.getUTCHours();
    const minutes = d.getUTCMinutes();
    let daysBack = day;
    // Sunday 23:00 Myanmar is Sunday 16:30 UTC
    if (day === 0) {
        if (hours < 16 || (hours === 16 && minutes < 30)) {
            daysBack = 7;
        }
    }
    return new Date(Date.UTC(
        d.getUTCFullYear(),
        d.getUTCMonth(),
        d.getUTCDate() - daysBack,
        16, 30, 0, 0
    ));
}

const cutoff = getLastSundayCutoff();
let shouldRun = false;

if (!fs.existsSync(file)) {
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
    echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] Export is pending for the latest Sunday cutoff. Executing..."
    if "$PROJECT_DIR/scripts/run-export.sh"; then
        node -e 'const fs = require("fs"); fs.writeFileSync(process.argv[1], new Date().toISOString(), "utf8");' "$LAST_SUCCESS_FILE"
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ✅ Export finished successfully. Timestamp updated."
    else
        echo "[WATCHDOG $(date '+%Y-%m-%d %H:%M:%S')] ❌ Export exited with error. Timestamp NOT updated (will retry next check)."
    fi
else
    # Already ran for the current cycle
    exit 0
fi
