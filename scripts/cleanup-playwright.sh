#!/bin/bash
# Auto-cleanup old Playwright test artifacts
# Run this script via cron or manually

set -e

DAYS_OLD=${1:-7}  # Default: delete files older than 7 days
DRY_RUN=${2:-false}

echo "🧹 Cleaning up Playwright artifacts older than $DAYS_OLD days..."

DIRS=(
  "test-results"
  "playwright-report"
  "traces"
  "screenshots"
  "videos"
)

TOTAL_SIZE_BEFORE=0
TOTAL_SIZE_AFTER=0
FILES_DELETED=0

for dir in "${DIRS[@]}"; do
  if [ -d "$dir" ]; then
    SIZE_BEFORE=$(du -sb "$dir" 2>/dev/null | cut -f1 || echo "0")
    TOTAL_SIZE_BEFORE=$((TOTAL_SIZE_BEFORE + SIZE_BEFORE))

    if [ "$DRY_RUN" = "true" ]; then
      echo "📂 Would clean: $dir"
      find "$dir" -type f -mtime +$DAYS_OLD 2>/dev/null | while read file; do
        echo "  - $file"
      done
    else
      echo "📂 Cleaning: $dir"
      COUNT=$(find "$dir" -type f -mtime +$DAYS_OLD 2>/dev/null | wc -l)
      find "$dir" -type f -mtime +$DAYS_OLD -delete 2>/dev/null || true
      FILES_DELETED=$((FILES_DELETED + COUNT))
      echo "  ✓ Deleted $COUNT old files"
    fi

    SIZE_AFTER=$(du -sb "$dir" 2>/dev/null | cut -f1 || echo "0")
    TOTAL_SIZE_AFTER=$((TOTAL_SIZE_AFTER + SIZE_AFTER))
  fi
done

# Clean up standalone image files (outside of test directories)
if [ "$DRY_RUN" != "true" ]; then
  find . -maxdepth 3 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" -o -name "*.webm" \) \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -mtime +$DAYS_OLD \
    -delete 2>/dev/null || true
fi

SAVED=$((TOTAL_SIZE_BEFORE - TOTAL_SIZE_AFTER))
SAVED_MB=$((SAVED / 1024 / 1024))

echo ""
echo "✅ Cleanup complete!"
echo "📊 Files deleted: $FILES_DELETED"
echo "💾 Space freed: ${SAVED_MB}MB"
echo "📂 Before: $((TOTAL_SIZE_BEFORE / 1024 / 1024))MB → After: $((TOTAL_SIZE_AFTER / 1024 / 1024))MB"

if [ "$DRY_RUN" = "true" ]; then
  echo ""
  echo "ℹ️  This was a dry run. Run without 'true' parameter to actually delete files."
fi
