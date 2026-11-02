#!/bin/bash
# Master export runner on Hetzner VPS (cron every Sunday 16:00 UTC = 22:30 Myanmar)
# Stores local copies in /var/www/longevity-bot/scripts/exports/ and uploads to Google Drive via rclone

PROJECT_DIR="/var/www/longevity-bot"
cd "$PROJECT_DIR"

export PATH="/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

mkdir -p "$PROJECT_DIR/scripts/exports"
LOG_FILE="$PROJECT_DIR/scripts/exports/export.log"

echo "==========================================================" >> "$LOG_FILE"
echo "=== [$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Running weekly analytics export (Hetzner VPS) ===" >> "$LOG_FILE"

extract_err() {
    tail -n 25 "$LOG_FILE" | grep -iE "\[ERROR\]|invalid_grant|fetch failed|error|fail" | tail -n 1 | sed -E 's/.*(\[ERROR\]|Error:|Ошибка:)[[:space:]]*//I' | cut -c 1-60
}

# 1. Supabase Weekly Funnel
echo "--- Running weekly funnel export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-weekly-metrics.ts" >> "$LOG_FILE" 2>&1
FUNNEL_CODE=$?
FUNNEL_ERR=""
if [ $FUNNEL_CODE -ne 0 ]; then
    FUNNEL_ERR=$(extract_err)
    [ -z "$FUNNEL_ERR" ] && FUNNEL_ERR="ошибка БД"
    echo "Warning: Funnel export failed ($FUNNEL_ERR)" >> "$LOG_FILE"
fi

# 2. YouTube Analytics API
echo "--- Running YouTube Analytics export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-youtube-metrics.ts" >> "$LOG_FILE" 2>&1
YOUTUBE_CODE=$?
YOUTUBE_ERR=""
if [ $YOUTUBE_CODE -ne 0 ]; then
    YOUTUBE_ERR=$(extract_err)
    [ -z "$YOUTUBE_ERR" ] && YOUTUBE_ERR="ошибка API"
    echo "Warning: YouTube export failed ($YOUTUBE_ERR)" >> "$LOG_FILE"
fi

# 3. Instagram Graph API
echo "--- Running Instagram Graph API export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-instagram-metrics.ts" >> "$LOG_FILE" 2>&1
INSTAGRAM_CODE=$?
INSTAGRAM_ERR=""
if [ $INSTAGRAM_CODE -ne 0 ]; then
    INSTAGRAM_ERR=$(extract_err)
    [ -z "$INSTAGRAM_ERR" ] && INSTAGRAM_ERR="ошибка API"
    echo "Warning: Instagram export failed ($INSTAGRAM_ERR)" >> "$LOG_FILE"
fi

# 4. Telegram Channel @VI_Beautylife
echo "--- Running Telegram Channel export ---" >> "$LOG_FILE"
/usr/bin/npx tsx "$PROJECT_DIR/scripts/export-telegram-channel.ts" >> "$LOG_FILE" 2>&1
TELEGRAM_CODE=$?
TELEGRAM_ERR=""
if [ $TELEGRAM_CODE -ne 0 ]; then
    TELEGRAM_ERR=$(extract_err)
    [ -z "$TELEGRAM_ERR" ] && TELEGRAM_ERR="ошибка парсинга"
    echo "Warning: Telegram export failed ($TELEGRAM_ERR)" >> "$LOG_FILE"
fi

# 5. Send Telegram Summary to user 175269194
/usr/bin/npx tsx "$PROJECT_DIR/scripts/notify-export-summary.ts" \
    --funnel "$FUNNEL_CODE" "$FUNNEL_ERR" \
    --youtube "$YOUTUBE_CODE" "$YOUTUBE_ERR" \
    --instagram "$INSTAGRAM_CODE" "$INSTAGRAM_ERR" \
    --telegram "$TELEGRAM_CODE" "$TELEGRAM_ERR" >> "$LOG_FILE" 2>&1 || true

# 6. Upload exported CSVs to Google Drive via rclone
echo "--- Uploading exports to Google Drive via rclone ---" >> "$LOG_FILE"
/usr/bin/rclone copy "$PROJECT_DIR/scripts/exports/" "gdrive:VIReyou/VIReyou_Аналитика/" --include "*.csv" >> "$LOG_FILE" 2>&1 || echo "Warning: rclone upload failed" >> "$LOG_FILE"

echo "=== [$(date -u '+%Y-%m-%d %H:%M:%S UTC')] Completed all exports and rclone upload on Hetzner VPS ===" >> "$LOG_FILE"
