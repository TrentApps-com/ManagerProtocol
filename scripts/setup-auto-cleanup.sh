#!/bin/bash
# Setup automatic cleanup via cron
# Run this once to install the cron job

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CLEANUP_SCRIPT="$SCRIPT_DIR/cleanup-playwright.sh"

echo "🔧 Setting up automatic Playwright artifact cleanup..."

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "cleanup-playwright.sh"; then
  echo "⚠️  Cron job already exists!"
  echo ""
  echo "Current cron jobs:"
  crontab -l | grep "cleanup-playwright.sh"
  echo ""
  read -p "Replace existing cron job? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cancelled"
    exit 0
  fi
  # Remove existing cron job
  crontab -l | grep -v "cleanup-playwright.sh" | crontab -
fi

# Add new cron job (runs daily at 3 AM)
(crontab -l 2>/dev/null; echo "0 3 * * * cd $SCRIPT_DIR/.. && $CLEANUP_SCRIPT 7 >> /var/log/playwright-cleanup.log 2>&1") | crontab -

echo "✅ Cron job installed!"
echo ""
echo "📅 Schedule: Daily at 3:00 AM"
echo "🗑️  Deletes: Files older than 7 days"
echo "📝 Logs: /var/log/playwright-cleanup.log"
echo ""
echo "To view cron jobs: crontab -l"
echo "To remove: crontab -e (then delete the line)"
echo ""
echo "To run manually now:"
echo "  npm run clean:test          # Delete ALL test artifacts"
echo "  npm run clean:test:old      # Delete only old artifacts (7+ days)"
echo "  $CLEANUP_SCRIPT 7 true      # Dry run (see what would be deleted)"
