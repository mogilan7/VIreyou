#!/bin/bash
# Master export runner on Hetzner VPS (cron every Sunday 16:00 UTC = 23:00 Myanmar)
# Stores local copies in /var/www/longevity-bot/scripts/exports/ and uploads to Google Drive via rclone

PROJECT_DIR="/var/www/longevity-bot"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT_DIR/scripts/exports"
LOG_FILE="$PROJECT_DIR/scripts/exports/export.log"

echo "==========================================================" >> "$LOG_FILE"
echo "=== [$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running weekly analytics export (Hetzner VPS) ===" >> "$LOG_FILE"

# 1. Supabase Weekly Funnel
echo "--- Running weekly funnel export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-weekly-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: Funnel export failed" >> "$LOG_FILE"

# 2. YouTube Analytics API
echo "--- Running YouTube Analytics export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-youtube-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: YouTube export skipped or failed" >> "$LOG_FILE"

# 3. Instagram Graph API
echo "--- Running Instagram Graph API export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-instagram-metrics.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: Instagram export skipped or failed" >> "$LOG_FILE"

# 4. Telegram Channel @VI_Beautylife
echo "--- Running Telegram Channel export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-telegram-channel.ts" >> "$LOG_FILE" 2>&1 || echo "Warning: Telegram export skipped or failed" >> "$LOG_FILE"

# 5. Upload exported CSVs to Google Drive via rclone
echo "--- Uploading exports to Google Drive via rclone ---" >> "$LOG_FILE"
/usr/bin/rclone copy "$PROJECT_DIR/scripts/exports/" "gdrive:VIReyou/VIReyou_Аналитика/" --include "*.csv" >> "$LOG_FILE" 2>&1 || echo "Warning: rclone upload failed" >> "$LOG_FILE"

echo "=== [$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Completed all exports and rclone upload on Hetzner VPS ===" >> "$LOG_FILE"
