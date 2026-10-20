#!/bin/bash
# Checks if the weekly export for this week has already run.
# If not (e.g. Mac was asleep or turned off), runs it immediately on wake/startup.

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

LAST_RUN_FILE="$PROJECT_DIR/scripts/exports/.last_run_timestamp"

# Current week identifier, e.g., 2026-42
CURRENT_WEEK=$(date '+%Y-%W')

if [ -f "$LAST_RUN_FILE" ]; then
    LAST_WEEK=$(cat "$LAST_RUN_FILE")
else
    LAST_WEEK=""
fi

# Run export if it has not been run yet for this week
if [ "$CURRENT_WEEK" != "$LAST_WEEK" ]; then
    echo "[LAUNCHD] Weekly export has not run for week $CURRENT_WEEK. Running now..."
    "$PROJECT_DIR/scripts/run-export.sh"
    echo "$CURRENT_WEEK" > "$LAST_RUN_FILE"
else
    echo "[LAUNCHD] Weekly export for week $CURRENT_WEEK has already completed."
fi
