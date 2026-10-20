#!/bin/bash
set -e

# Export runner for launchd / cron
PROJECT_DIR="/Users/mogilevandrei/Desktop/VIReYou/VIReYou_content_factory/longevity-portal"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT_DIR/scripts/exports"
LOG_FILE="$PROJECT_DIR/scripts/exports/export.log"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S %z')] Running weekly funnel metrics export ===" >> "$LOG_FILE"
/usr/local/bin/npx tsx "$PROJECT_DIR/scripts/export-weekly-metrics.ts" >> "$LOG_FILE" 2>&1
echo "=== Finished with exit code $? ===" >> "$LOG_FILE"
