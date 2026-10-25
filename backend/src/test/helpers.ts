import { testDb } from './setup.js';
import { createSession } from '../services/authSessions.js';

// Issue a real server-side session for a profile and return request headers
export function authHeaders(profileId: number): Record<string, string> {
  const { token } = createSession(profileId, 'vitest');
  return { Authorization: `Bearer ${token}` };
}

// Create a test profile
export function createTestProfile(overrides: Partial<{
  name: string;
  type: 'admin' | 'parent' | 'child';
  age: number;
  avatar: string;
  pin: string;
  parent_id: number;
  family_id: number;
  ai_enabled: number;
  diet_enabled: number;
}> = {}) {
  const defaults = {
    name: 'Test User',
    type: 'child' as const,
    age: 10,
    avatar: null,
    pin: null,
    parent_id: null,
    family_id: null,
    ai_enabled: 0,
    diet_enabled: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO profiles (name, type, age, avatar, pin, parent_id, family_id, ai_enabled, diet_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(data.name, data.type, data.age, data.avatar, data.pin, data.parent_id, data.family_id, data.ai_enabled, data.diet_enabled);

  return testDb.prepare('SELECT * FROM profiles WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test task
export function createTestTask(profileId: number, overrides: Partial<{
  title: string;
  description: string;
  category: string;
  points: number;
  difficulty: string;
  completed: number;
  needs_approval: number;
  parent_approved: number;
  is_recurring: number;
  recurrence_pattern: string;
  due_date: string;
  last_completed_date: string;
  estimated_minutes: number;
  priority: string;
  created_by: number;
  proof_required: number;
  proof_photo_url: string;
  requires_timer: number;
  timer_duration_minutes: number;
  scheduled_time: string;
  }> = {}) {
  const defaults = {
    title: 'Test Task',
    description: 'Test description',
    category: 'other',
    points: 10,
    difficulty: 'easy',
    completed: 0,
    needs_approval: 0,
    parent_approved: 1,
    is_recurring: 0,
    recurrence_pattern: null,
    due_date: null,
    last_completed_date: null,
    estimated_minutes: null,
    priority: 'medium',
    created_by: null,
    proof_required: 0,
    proof_photo_url: null,
    requires_timer: 0,
    timer_duration_minutes: null,
    scheduled_time: null
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO tasks (
      profile_id, title, description, category, points, difficulty, completed, needs_approval,
      parent_approved, is_recurring, recurrence_pattern, due_date, last_completed_date,
      estimated_minutes, priority, created_by, proof_required, proof_photo_url,
      requires_timer, timer_duration_minutes, scheduled_time
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    profileId,
    data.title,
    data.description,
    data.category,
    data.points,
    data.difficulty,
    data.completed,
    data.needs_approval,
    data.parent_approved,
    data.is_recurring,
    data.recurrence_pattern,
    data.due_date,
    data.last_completed_date,
    data.estimated_minutes,
    data.priority,
    data.created_by,
    data.proof_required,
    data.proof_photo_url,
    data.requires_timer,
    data.timer_duration_minutes,
    data.scheduled_time
  );

  return testDb.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test note
export function createTestNote(profileId: number, overrides: Partial<{
  title: string;
  content: string;
  color: string;
  category: string;
  is_pinned: number;
}> = {}) {
  const defaults = {
    title: 'Test Note',
    content: 'Test content',
    color: '#ffffff',
    category: null,
    is_pinned: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO notes (profile_id, title, content, color, category, is_pinned)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(profileId, data.title, data.content, data.color, data.category, data.is_pinned);

  return testDb.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create initial progress for a profile
export function createTestProgress(profileId: number, overrides: Partial<{
  points_earned: number;
  stars_earned: number;
  level: number;
  total_points: number;
  total_stars: number;
}> = {}) {
  const defaults = {
    points_earned: 0,
    stars_earned: 0,
    level: 1,
    total_points: 0,
    total_stars: 0
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO progress (profile_id, points_earned, stars_earned, level, total_points, total_stars)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(profileId, data.points_earned, data.stars_earned, data.level, data.total_points, data.total_stars);

  return testDb.prepare('SELECT * FROM progress WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test streak
export function createTestStreak(profileId: number, streakType: string = 'tasks', overrides: Partial<{
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}> = {}) {
  const defaults = {
    current_streak: 0,
    longest_streak: 0,
    last_activity_date: null
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO streaks (profile_id, streak_type, current_streak, longest_streak, last_activity_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(profileId, streakType, data.current_streak, data.longest_streak, data.last_activity_date);

  return testDb.prepare('SELECT * FROM streaks WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Create a test achievement
export function createTestAchievement(overrides: Partial<{
  name: string;
  description: string;
  icon: string;
  points_reward: number;
  requirement_type: string;
  requirement_value: number;
}> = {}) {
  const defaults = {
    name: 'Test Achievement',
    description: 'Test achievement description',
    icon: 'trophy',
    points_reward: 10,
    requirement_type: 'tasks_completed',
    requirement_value: 5
  };

  const data = { ...defaults, ...overrides };

  const result = testDb.prepare(`
    INSERT INTO achievements (name, description, icon, points_reward, requirement_type, requirement_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(data.name, data.description, data.icon, data.points_reward, data.requirement_type, data.requirement_value);

  return testDb.prepare('SELECT * FROM achievements WHERE id = ?').get(result.lastInsertRowid) as any;
}

// Existing-engine tables FamilyHub Learn builds on (activity engine, audit log, AI settings)
export function createLearnEngineTables() {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT, entity_type TEXT, entity_id INTEGER, actor_id INTEGER, actor_type TEXT,
      details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      strict_mode INTEGER DEFAULT 1,
      max_messages_per_day INTEGER DEFAULT 20,
      content_filter_level TEXT DEFAULT 'strict',
      custom_instructions TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS activity_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS learning_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL, description TEXT, topic TEXT NOT NULL, age_range TEXT,
      created_by INTEGER NOT NULL, assigned_to INTEGER NOT NULL,
      points_per_activity INTEGER DEFAULT 20, stars_per_session INTEGER DEFAULT 1, bonus_points INTEGER DEFAULT 50,
      time_limit_seconds INTEGER, pass_threshold INTEGER DEFAULT 70, is_ai_generated INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1, is_competition INTEGER DEFAULT 0, competition_ends_at DATETIME,
      first_place_bonus INTEGER DEFAULT 50, second_place_bonus INTEGER DEFAULT 25, third_place_bonus INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS learning_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL, activity_type_id INTEGER NOT NULL, title TEXT NOT NULL, instructions TEXT,
      content_data TEXT NOT NULL, correct_data TEXT NOT NULL, hints TEXT, explanation TEXT,
      points INTEGER DEFAULT 20, time_limit_seconds INTEGER, order_index INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS session_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL, profile_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME,
      total_activities INTEGER NOT NULL, completed_activities INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0, max_possible_score INTEGER NOT NULL,
      score_percentage INTEGER DEFAULT 0, points_earned INTEGER DEFAULT 0, stars_earned INTEGER DEFAULT 0,
      time_bonus_points INTEGER DEFAULT 0, time_taken_seconds INTEGER, passed INTEGER DEFAULT 0,
      competition_rank INTEGER, bonus_awarded INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS activity_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL, activity_id INTEGER NOT NULL, user_response TEXT,
      score INTEGER DEFAULT 0, max_score INTEGER DEFAULT 0, is_correct INTEGER DEFAULT 0,
      partial_score REAL DEFAULT 0, hints_used INTEGER DEFAULT 0, time_taken_seconds INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  testDb.exec(`
    INSERT OR IGNORE INTO activity_types (name, display_name, icon) VALUES
      ('multiple_choice', 'Multiple choice', '🔘'), ('fill_blanks', 'Fill in the blanks', '✏️')
  `);
}
