import { db } from '../init';

/**
 * Phase 1: Production Ready Features Migration
 * - Subtasks table
 * - Photo proof columns on tasks
 * - Reminder preferences table
 * - Enhanced rewards for shop
 */
export function runProductionReadyMigrations() {
  console.log('🚀 Running production-ready migrations...');

  // Subtasks table (for task breakdown)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS subtasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      completed BOOLEAN DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_subtasks_task ON subtasks(task_id)
  `).run();

  console.log('✅ Subtasks table created');

  // Reminder preferences table (for scheduled push notifications)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS reminder_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      morning_reminder_time TEXT DEFAULT '07:30',
      evening_reminder_time TEXT DEFAULT '18:00',
      reminder_enabled BOOLEAN DEFAULT 1,
      weekend_reminders BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_reminder_preferences_profile ON reminder_preferences(profile_id)
  `).run();

  console.log('✅ Reminder preferences table created');

  // Migration: Add photo proof columns to tasks table
  try {
    const tasksInfo: any[] = db.prepare('PRAGMA table_info(tasks)').all();
    const hasProofPhotoUrl = tasksInfo.some((col: any) => col.name === 'proof_photo_url');
    const hasProofRequired = tasksInfo.some((col: any) => col.name === 'proof_required');
    const hasPriority = tasksInfo.some((col: any) => col.name === 'priority');
    const hasEstimatedMinutes = tasksInfo.some((col: any) => col.name === 'estimated_minutes');

    if (!hasProofPhotoUrl) {
      console.log('🔄 Migrating tasks table: adding proof_photo_url column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN proof_photo_url TEXT').run();
      console.log('✅ Added proof_photo_url column to tasks');
    }

    if (!hasProofRequired) {
      console.log('🔄 Migrating tasks table: adding proof_required column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN proof_required BOOLEAN DEFAULT 0').run();
      console.log('✅ Added proof_required column to tasks');
    }

    if (!hasPriority) {
      console.log('🔄 Migrating tasks table: adding priority column...');
      db.prepare("ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT 'medium'").run();
      console.log('✅ Added priority column to tasks');
    }

    if (!hasEstimatedMinutes) {
      console.log('🔄 Migrating tasks table: adding estimated_minutes column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN estimated_minutes INTEGER').run();
      console.log('✅ Added estimated_minutes column to tasks');
    }
  } catch (error: any) {
    console.error('Migration error (tasks photo proof):', error.message);
  }

  // Migration: Add shop-related columns to rewards table
  try {
    const rewardsInfo: any[] = db.prepare('PRAGMA table_info(rewards)').all();
    const hasCreatedBy = rewardsInfo.some((col: any) => col.name === 'created_by');
    const hasImageUrl = rewardsInfo.some((col: any) => col.name === 'image_url');
    const hasCategory = rewardsInfo.some((col: any) => col.name === 'category');
    const hasAvailableForAll = rewardsInfo.some((col: any) => col.name === 'available_for_all');
    const hasStock = rewardsInfo.some((col: any) => col.name === 'stock');

    if (!hasCreatedBy) {
      console.log('🔄 Migrating rewards table: adding created_by column...');
      db.prepare('ALTER TABLE rewards ADD COLUMN created_by INTEGER REFERENCES profiles(id)').run();
      console.log('✅ Added created_by column to rewards');
    }

    if (!hasImageUrl) {
      console.log('🔄 Migrating rewards table: adding image_url column...');
      db.prepare('ALTER TABLE rewards ADD COLUMN image_url TEXT').run();
      console.log('✅ Added image_url column to rewards');
    }

    if (!hasCategory) {
      console.log('🔄 Migrating rewards table: adding category column...');
      db.prepare("ALTER TABLE rewards ADD COLUMN category TEXT DEFAULT 'general'").run();
      console.log('✅ Added category column to rewards');
    }

    if (!hasAvailableForAll) {
      console.log('🔄 Migrating rewards table: adding available_for_all column...');
      db.prepare('ALTER TABLE rewards ADD COLUMN available_for_all BOOLEAN DEFAULT 0').run();
      console.log('✅ Added available_for_all column to rewards');
    }

    if (!hasStock) {
      console.log('🔄 Migrating rewards table: adding stock column...');
      db.prepare('ALTER TABLE rewards ADD COLUMN stock INTEGER DEFAULT -1').run();
      console.log('✅ Added stock column to rewards (-1 = unlimited)');
    }
  } catch (error: any) {
    console.error('Migration error (rewards shop columns):', error.message);
  }

  // Reward claims table (track purchased/claimed rewards separately)
  db.prepare(`
    CREATE TABLE IF NOT EXISTS reward_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'given', 'rejected')),
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      approved_by INTEGER,
      notes TEXT,
      FOREIGN KEY (reward_id) REFERENCES rewards(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (approved_by) REFERENCES profiles(id)
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_reward_claims_profile ON reward_claims(profile_id)
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_reward_claims_status ON reward_claims(status)
  `).run();

  console.log('✅ Reward claims table created');

  // Migration: Add stars_spent column to reward_claims for star discount feature
  try {
    const claimColumns = db.prepare("PRAGMA table_info(reward_claims)").all() as any[];
    const hasStarsSpent = claimColumns.some((c: any) => c.name === 'stars_spent');

    if (!hasStarsSpent) {
      console.log('🔄 Migrating reward_claims table: adding stars_spent column...');
      db.prepare('ALTER TABLE reward_claims ADD COLUMN stars_spent INTEGER DEFAULT 0').run();
      console.log('✅ Added stars_spent column to reward_claims');
    }
  } catch (error: any) {
    console.error('Migration error (reward_claims stars_spent):', error.message);
  }

  // Migration: Normalize duplicate categories in rewards table (lowercase + trim)
  try {
    db.prepare(`
      UPDATE rewards SET category = LOWER(TRIM(category))
      WHERE category IS NOT NULL AND category != LOWER(TRIM(category))
    `).run();
  } catch (error: any) {
    console.error('Migration error (normalize categories):', error.message);
  }

  // Migration: Fix any proof_photo_url that has /api prefix (should be just /tasks/...)
  try {
    const result = db.prepare(`
      UPDATE tasks
      SET proof_photo_url = REPLACE(proof_photo_url, '/api/tasks/', '/tasks/')
      WHERE proof_photo_url LIKE '/api/tasks/%'
    `).run();

    if (result.changes > 0) {
      console.log(`✅ Fixed ${result.changes} proof_photo_url entries (removed /api prefix)`);
    }
  } catch (error: any) {
    console.error('Migration error (fix proof_photo_url):', error.message);
  }

  console.log('🎉 Production-ready migrations completed!');
}
