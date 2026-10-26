import Database, { Database as DatabaseType } from 'better-sqlite3';
import { beforeAll, afterAll, afterEach, vi } from 'vitest';

// Create in-memory database for tests
export const testDb: DatabaseType = new Database(':memory:');

// Initialize tables needed for tests
export function initTestDb() {
  // Profiles table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      age INTEGER,
      avatar TEXT,
      pin TEXT,
      parent_id INTEGER,
      family_id INTEGER,
      ai_enabled INTEGER DEFAULT 0,
      diet_enabled INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    testDb.exec(`ALTER TABLE profiles ADD COLUMN username TEXT`);
  } catch {}
  try {
    testDb.exec(`ALTER TABLE profiles ADD COLUMN password TEXT`);
  } catch {}
  try {
    testDb.exec(`ALTER TABLE profiles ADD COLUMN gender TEXT`);
  } catch {}

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      family_type TEXT DEFAULT 'A',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS guardian_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      relationship TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(guardian_id, student_id)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS profile_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      feature_key TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, feature_key)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS family_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      feature_key TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(parent_id, feature_key)
    )
  `);

  // Tasks table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      points INTEGER DEFAULT 10,
      difficulty TEXT DEFAULT 'easy',
      earns_points BOOLEAN DEFAULT 1,
      is_recurring BOOLEAN DEFAULT 0,
      recurrence_pattern TEXT,
      due_date DATETIME,
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      last_completed_date TEXT,
      needs_approval BOOLEAN DEFAULT 0,
      approved BOOLEAN DEFAULT 0,
      approved_by INTEGER,
      parent_approved BOOLEAN DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      estimated_minutes INTEGER,
      proof_required BOOLEAN DEFAULT 0,
      proof_photo_url TEXT,
      requires_timer BOOLEAN DEFAULT 0,
      timer_duration_minutes INTEGER,
      scheduled_time TEXT,
      last_reminder_sent DATETIME,
      deleted_at DATETIME,
      deleted_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )
  `);
  try {
    testDb.exec(`ALTER TABLE tasks ADD COLUMN scheduled_time TEXT`);
  } catch {}
  try {
    testDb.exec(`ALTER TABLE tasks ADD COLUMN last_reminder_sent DATETIME`);
  } catch {}

  // Progress table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      task_id INTEGER,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      total_points INTEGER DEFAULT 0,
      total_stars INTEGER DEFAULT 0,
      achievements TEXT DEFAULT '[]',
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Notes table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      color TEXT DEFAULT '#ffffff',
      category TEXT,
      tags TEXT,
      is_pinned BOOLEAN DEFAULT 0,
      reminder_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER,
      age_range TEXT DEFAULT '4-8',
      language TEXT DEFAULT 'en',
      genre TEXT DEFAULT 'story',
      theme TEXT,
      total_pages INTEGER DEFAULT 0,
      cover_image TEXT,
      author TEXT,
      book_source TEXT DEFAULT 'ai',
      source_location TEXT,
      isbn TEXT,
      is_ai_generated INTEGER DEFAULT 0,
      ai_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      image_prompt TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      icon TEXT DEFAULT '📚',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_category_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      UNIQUE(book_id, category_id)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      current_page INTEGER DEFAULT 0,
      pages_read INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      reading_status TEXT DEFAULT 'reading',
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      liked INTEGER DEFAULT 0,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(book_id, profile_id)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS book_reading_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      note_type TEXT DEFAULT 'learning',
      content TEXT NOT NULL,
      page_reference INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Settings table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS ai_generation_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL UNIQUE,
      daily_book_limit INTEGER DEFAULT 5,
      daily_quiz_limit INTEGER DEFAULT 10,
      daily_task_limit INTEGER DEFAULT 20,
      daily_activity_limit INTEGER DEFAULT 10,
      monthly_cost_limit REAL DEFAULT 10,
      require_approval INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      parent_id INTEGER,
      feature_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      estimated_cost REAL DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      images_generated INTEGER DEFAULT 0,
      success INTEGER DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT DEFAULT 'real',
      points_required INTEGER NOT NULL,
      icon TEXT,
      image_url TEXT,
      category TEXT DEFAULT 'general',
      available_for_all BOOLEAN DEFAULT 1,
      stock INTEGER DEFAULT -1,
      is_claimed BOOLEAN DEFAULT 0,
      claimed_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS reward_claims (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reward_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      points_spent INTEGER NOT NULL,
      stars_spent INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      approved_by INTEGER,
      approved_at DATETIME,
      notes TEXT,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Push subscriptions table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, endpoint)
    )
  `);

  // Notifications table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Streaks table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      streak_type TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      quality_score INTEGER DEFAULT 0,
      last_activity_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Achievements table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      badge_color TEXT DEFAULT '#6366f1',
      points_reward INTEGER DEFAULT 0,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL,
      -- Present in database/init.ts and queried by the gamification routes; the
      -- test schema is hand-built and had drifted without it, so any path
      -- reaching a hidden-achievement query failed with 'no such column'
      is_hidden BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Profile achievements table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS profile_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Monthly goals table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS monthly_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      month TEXT NOT NULL,
      goal_description TEXT NOT NULL,
      goal_points INTEGER NOT NULL,
      goal_type TEXT DEFAULT 'kroner',
      goal_category TEXT DEFAULT 'monthly',
      reward_image TEXT,
      current_points INTEGER DEFAULT 0,
      achieved BOOLEAN DEFAULT 0,
      reward_given BOOLEAN DEFAULT 0,
      notes TEXT,
      parent_approved BOOLEAN DEFAULT 0,
      created_by INTEGER,
      approved_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS goal_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      milestone_points INTEGER NOT NULL,
      milestone_reward TEXT NOT NULL,
      achieved BOOLEAN DEFAULT 0,
      achieved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS reward_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      icon TEXT DEFAULT '🎁',
      description TEXT,
      color TEXT DEFAULT '#9333ea',
      created_by INTEGER,
      is_default BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(name, created_by)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS goal_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      icon TEXT DEFAULT '🎯',
      suggested_points INTEGER NOT NULL,
      estimated_cost_min REAL DEFAULT 0,
      estimated_cost_max REAL DEFAULT 0,
      cost_currency TEXT DEFAULT 'USD',
      family_size_multiplier REAL DEFAULT 1.0,
      is_default BOOLEAN DEFAULT 1,
      is_system BOOLEAN DEFAULT 1,
      is_active BOOLEAN DEFAULT 1,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Water intake table (for gamification stats)
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS water_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      amount_ml INTEGER NOT NULL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Timer logs table (for streak quality calculations) - simplified for tests
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS timer_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      timer_type TEXT NOT NULL CHECK(timer_type IN ('task', 'quiz')),
      duration_seconds INTEGER NOT NULL,
      total_duration_seconds INTEGER NOT NULL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('pending', 'synced', 'failed'))
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS timer_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      task_id INTEGER,
      quiz_attempt_id INTEGER,
      timer_type TEXT NOT NULL,
      is_running BOOLEAN DEFAULT 0,
      is_paused BOOLEAN DEFAULT 0,
      elapsed_seconds INTEGER DEFAULT 0,
      start_time DATETIME,
      pause_time DATETIME,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS countdown_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT,
      description TEXT,
      target_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      duration_minutes INTEGER DEFAULT 0,
      bonus_multiplier REAL DEFAULT 1,
      accumulated_points INTEGER DEFAULT 0,
      completed BOOLEAN DEFAULT 0,
      bonus_points_awarded INTEGER DEFAULT 0,
      expires_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS spin_wheel_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      reward_type TEXT,
      reward_value INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Economy settings table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS economy_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      daily_points_cap INTEGER DEFAULT 100,
      weekly_points_cap INTEGER DEFAULT 500,
      points_multiplier REAL DEFAULT 1.0,
      require_time_elapsed BOOLEAN DEFAULT 0,
      min_task_duration_minutes INTEGER DEFAULT 5,
      cooldown_seconds INTEGER DEFAULT 60,
      bonuses_enabled BOOLEAN DEFAULT 1,
      spin_wheel_enabled BOOLEAN DEFAULT 1,
      countdown_challenges_enabled BOOLEAN DEFAULT 1,
      streak_bonus_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS earning_tracker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      bonuses_claimed INTEGER DEFAULT 0,
      last_action_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, date)
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS power_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      power_up_type TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE IF NOT EXISTS points_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      adjusted_by INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      related_task_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Family quizzes table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS family_quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      difficulty TEXT DEFAULT 'medium',
      total_questions INTEGER NOT NULL,
      time_limit_minutes INTEGER,
      points_per_question INTEGER DEFAULT 10,
      is_public BOOLEAN DEFAULT 0,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Family quiz attempts table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS family_quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      time_spent_seconds INTEGER,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES family_quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Rate limit tracker table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_tracker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      last_task_complete_at DATETIME,
      last_bonus_claim_at DATETIME,
      last_spin_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);
}

// Clear all data from tables
export function clearTestDb() {
  // auth_sessions is created lazily by services/authSessions
  try {
    testDb.exec('DELETE FROM auth_sessions');
  } catch {}
  testDb.exec('DELETE FROM family_features');
  testDb.exec('DELETE FROM profile_features');
  testDb.exec('DELETE FROM guardian_students');
  testDb.exec('DELETE FROM families');
  testDb.exec('DELETE FROM profile_achievements');
  testDb.exec('DELETE FROM achievements');
  testDb.exec('DELETE FROM streaks');
  testDb.exec('DELETE FROM progress');
  testDb.exec('DELETE FROM tasks');
  testDb.exec('DELETE FROM notes');
  testDb.exec('DELETE FROM book_category_mapping');
  testDb.exec('DELETE FROM book_pages');
  testDb.exec('DELETE FROM book_feedback');
  testDb.exec('DELETE FROM book_reading_notes');
  testDb.exec('DELETE FROM book_reading_progress');
  testDb.exec('DELETE FROM book_categories');
  testDb.exec('DELETE FROM books');
  testDb.exec('DELETE FROM reward_claims');
  testDb.exec('DELETE FROM rewards');
  testDb.exec('DELETE FROM ai_usage_logs');
  testDb.exec('DELETE FROM ai_generation_limits');
  testDb.exec('DELETE FROM settings');
  testDb.exec('DELETE FROM notifications');
  testDb.exec('DELETE FROM push_subscriptions');
  testDb.exec('DELETE FROM goal_milestones');
  testDb.exec('DELETE FROM monthly_goals');
  testDb.exec('DELETE FROM goal_templates');
  testDb.exec('DELETE FROM reward_categories');
  testDb.exec('DELETE FROM water_intake');
  testDb.exec('DELETE FROM timer_logs');
  testDb.exec('DELETE FROM timer_states');
  testDb.exec('DELETE FROM spin_wheel_history');
  testDb.exec('DELETE FROM countdown_challenges');
  testDb.exec('DELETE FROM points_adjustments');
  testDb.exec('DELETE FROM power_ups');
  testDb.exec('DELETE FROM earning_tracker');
  testDb.exec('DELETE FROM economy_settings');
  testDb.exec('DELETE FROM family_quiz_attempts');
  testDb.exec('DELETE FROM family_quizzes');
  testDb.exec('DELETE FROM rate_limit_tracker');
  testDb.exec('DELETE FROM profiles');
}

// Mock the database module
vi.mock('../database/init', () => ({
  default: testDb,
  db: testDb,
  initDatabase: vi.fn()
}));

// Setup before all tests
beforeAll(() => {
  initTestDb();
});

// Clear data after each test
afterEach(() => {
  clearTestDb();
});

// Close database after all tests
afterAll(() => {
  testDb.close();
});
