#!/bin/bash
# Master export runner for launchd (Mac) and cron (Hetzner VPS)

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT_DIR/scripts/exports"
LOG_FILE="$PROJECT_DIR/scripts/exports/export.log"

echo "==========================================================" >> "$LOG_FILE"
echo "=== [$(date '+%Y-%m-%d %H:%M:%S %z')] Running full weekly analytics export ===" >> "$LOG_FILE"

# 1. Supabase Weekly Funnel
echo "--- Running weekly funnel export ---" >> "$LOG_FILE"
/usr/local/bin/npx tsx "$PROJECT_DIR/scripts/export-weekly-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: Funnel export failed" >> "$LOG_FILE"

# 2. YouTube Analytics API
echo "--- Running YouTube Analytics export ---" >> "$LOG_FILE"
/usr/local/bin/npx tsx "$PROJECT_DIR/scripts/export-youtube-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: YouTube export skipped or failed" >> "$LOG_FILE"

# 3. Instagram Graph API
echo "--- Running Instagram Graph API export ---" >> "$LOG_FILE"
/usr/local/bin/npx tsx "$PROJECT_DIR/scripts/export-instagram-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: Instagram export skipped or failed" >> "$LOG_FILE"

echo "=== [$(date '+%Y-%m-%d %H:%M:%S %z')] Completed all exports ===" >> "$LOG_FILE"
