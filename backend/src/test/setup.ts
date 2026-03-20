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
      ai_enabled INTEGER DEFAULT 0,
      diet_enabled INTEGER DEFAULT 0,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
      needs_approval BOOLEAN DEFAULT 0,
      approved BOOLEAN DEFAULT 0,
      approved_by INTEGER,
      parent_approved BOOLEAN DEFAULT 0,
      priority TEXT DEFAULT 'medium',
      estimated_minutes INTEGER,
      proof_required BOOLEAN DEFAULT 0,
      proof_photo_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER
    )
  `);

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

  // Settings table
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  testDb.exec('DELETE FROM profile_achievements');
  testDb.exec('DELETE FROM achievements');
  testDb.exec('DELETE FROM streaks');
  testDb.exec('DELETE FROM progress');
  testDb.exec('DELETE FROM tasks');
  testDb.exec('DELETE FROM notes');
  testDb.exec('DELETE FROM settings');
  testDb.exec('DELETE FROM notifications');
  testDb.exec('DELETE FROM push_subscriptions');
  testDb.exec('DELETE FROM monthly_goals');
  testDb.exec('DELETE FROM water_intake');
  testDb.exec('DELETE FROM timer_logs');
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
