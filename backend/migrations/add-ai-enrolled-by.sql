-- Migration: Add enrolled_by to ai_settings for AI enrollment audit
-- Run this once; idempotent where possible

-- Step 1: Check if column exists
-- (Manual check or run PRAGMA separately; if exists, comment out ALTER)

-- Add enrolled_by if missing (SQLite doesn't support IF NOT EXISTS for ALTER, so check first)
-- PRAGMA table_info(ai_settings);  -- Run this to check column names

ALTER TABLE ai_settings ADD COLUMN enrolled_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL;

-- Index for queries
CREATE INDEX IF NOT EXISTS idx_ai_settings_enrolled_by ON ai_settings(enrolled_by);

-- Backfill: For existing enabled child profiles, attribute to admin (ID 1)
UPDATE ai_settings
SET enrolled_by = 1
WHERE enrolled_by IS NULL
  AND profile_id IN (
    SELECT id FROM profiles 
    WHERE ai_enabled = 1 AND type = 'child'
  );

-- Ensure defaults for enabled children without settings
INSERT OR IGNORE INTO ai_settings (profile_id, strict_mode, max_messages_per_day, content_filter_level, custom_instructions, enrolled_by)
SELECT p.id, 1, 20, 'strict', '', 1
FROM profiles p
WHERE p.type = 'child' 
  AND p.ai_enabled = 1
  AND p.id NOT IN (SELECT profile_id FROM ai_settings);

-- Verify changes
SELECT 'enrolled_by column added' as status;
SELECT COUNT(*) as total_settings FROM ai_settings;
SELECT COUNT(*) as enabled_children FROM profiles WHERE type = 'child' AND ai_enabled = 1;
SELECT COUNT(*) as backfilled FROM ai_settings WHERE enrolled_by = 1;