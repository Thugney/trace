import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { runProductionReadyMigrations } from './migrations/production-ready';
import { FEATURE_KEYS } from '../services/feature-keys';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/family.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: Database.Database = new Database(DB_PATH);

// Enable WAL mode for better concurrency (allows multiple readers during writes)
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Set busy timeout to 5 seconds (prevents SQLITE_BUSY errors)
db.pragma('busy_timeout = 5000');

export function initDatabase() {
  console.log('📦 Initializing database...');

  // Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('admin', 'parent', 'child', 'teacher')),
      age INTEGER,
      gender TEXT CHECK(gender IN ('male', 'female', 'other')),
      avatar TEXT,
      pin TEXT,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Diet goals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS diet_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      calories_target INTEGER,
      protein_target INTEGER,
      carbs_target INTEGER,
      fat_target INTEGER,
      weight_goal REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Food items table (Norwegian foods and custom entries)
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_no TEXT,
      brand TEXT,
      calories INTEGER NOT NULL,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      fiber REAL DEFAULT 0,
      serving_size TEXT,
      serving_unit TEXT DEFAULT 'g',
      barcode TEXT,
      source TEXT DEFAULT 'custom',
      is_norwegian BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Meal logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      food_id INTEGER NOT NULL,
      meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      portion_size REAL NOT NULL,
      portion_unit TEXT DEFAULT 'g',
      calories_consumed INTEGER,
      protein_consumed REAL,
      carbs_consumed REAL,
      fat_consumed REAL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (food_id) REFERENCES food_items(id)
    )
  `);

  // Meal plans table
  db.exec(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      day_of_week INTEGER CHECK(day_of_week BETWEEN 0 AND 6),
      meal_type TEXT CHECK(meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
      recipe_data TEXT,
      is_family_plan BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Tasks table (for kids)
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT CHECK(category IN ('read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school', 'watch-movies', 'other')),
      points INTEGER DEFAULT 10,
      difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
      earns_points BOOLEAN DEFAULT 1,
      is_recurring BOOLEAN DEFAULT 0,
      recurrence_pattern TEXT,
      due_date DATETIME,
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_by INTEGER,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id)
    )
  `);

  // Progress tracking table
  db.exec(`
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
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);

  // Rewards table
  db.exec(`
    CREATE TABLE IF NOT EXISTS rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT CHECK(type IN ('virtual', 'real')) DEFAULT 'real',
      points_required INTEGER NOT NULL,
      icon TEXT,
      image_url TEXT,
      category TEXT DEFAULT 'general',
      available_for_all BOOLEAN DEFAULT 1,
      stock INTEGER DEFAULT -1,
      is_claimed BOOLEAN DEFAULT 0,
      claimed_at DATETIME,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add missing columns to rewards table for existing databases
  try {
    db.exec(`ALTER TABLE rewards ADD COLUMN image_url TEXT`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE rewards ADD COLUMN category TEXT DEFAULT 'general'`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE rewards ADD COLUMN available_for_all BOOLEAN DEFAULT 1`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE rewards ADD COLUMN stock INTEGER DEFAULT -1`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE rewards ADD COLUMN created_by INTEGER`);
  } catch (e) { /* Column already exists */ }

  // Monthly goals table
  db.exec(`
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id),
      FOREIGN KEY (approved_by) REFERENCES profiles(id)
    )
  `);

  // AI conversation history
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      context TEXT CHECK(context IN ('diet', 'tasks', 'general')),
      user_message TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Notes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      color TEXT DEFAULT '#ffffff',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Profile feature access table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      feature_key TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 0,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(profile_id, feature_key)
    )
  `);

  // Family feature access table (admin-controlled, overrides profile_features)
  // parent_id = the parent profile who heads this family
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_features (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      feature_key TEXT NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by INTEGER,
      FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (updated_by) REFERENCES profiles(id) ON DELETE SET NULL,
      UNIQUE(parent_id, feature_key)
    )
  `);

  // AI settings table for parental controls
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      strict_mode BOOLEAN DEFAULT 1,
      max_messages_per_day INTEGER DEFAULT 20,
      allowed_contexts TEXT DEFAULT '["general","tasks"]',
      content_filter_level TEXT DEFAULT 'strict',
      custom_instructions TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meal_logs_profile ON meal_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_profile ON tasks(profile_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent_approved ON tasks(parent_approved);
    CREATE INDEX IF NOT EXISTS idx_progress_profile ON progress(profile_id);
    CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile ON ai_conversations(profile_id);
    CREATE INDEX IF NOT EXISTS idx_notes_profile ON notes(profile_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_profile_month ON monthly_goals(profile_id, month);
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_parent_approved ON monthly_goals(parent_approved);
    CREATE INDEX IF NOT EXISTS idx_ai_settings_profile ON ai_settings(profile_id);
    CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON profiles(parent_id);
    CREATE INDEX IF NOT EXISTS idx_profile_features_profile ON profile_features(profile_id);
    CREATE INDEX IF NOT EXISTS idx_profile_features_feature ON profile_features(feature_key);
  `);

  // Insert default settings if none exist
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };

  if (settingsCount.count === 0) {
    console.log('📝 Creating default settings...');

    const settings = [
      { key: 'grok_api_enabled', value: 'false' },
      { key: 'norwegian_food_api', value: 'matvaretabellen' },
      { key: 'parent_pin', value: '' },
      { key: 'school_only_mode', value: 'false' }
    ];

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    settings.forEach(setting => {
      insertSetting.run(setting.key, setting.value);
    });

    console.log('✅ Default settings created');
  }

  // School Classes table (Tigrinya Church School)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_classes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      age_min INTEGER,
      age_max INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // School Class Enrollments (which students are in which class)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      UNIQUE(student_id, class_id)
    )
  `);

  // Guardian-student relationships (optional multi-parent support)
  db.exec(`
    CREATE TABLE IF NOT EXISTS guardian_students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guardian_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      relationship TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (guardian_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(guardian_id, student_id)
    )
  `);

  // Teacher-class assignments (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS teacher_class_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      UNIQUE(teacher_id, class_id)
    )
  `);

  // School Assignments (homework, psalms, videos, quizzes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT CHECK(type IN ('homework', 'psalm', 'alphabet', 'video', 'quiz', 'other')) DEFAULT 'homework',
      youtube_link TEXT,
      attachment_url TEXT,
      linked_quiz_id INTEGER,
      due_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (linked_quiz_id) REFERENCES family_quizzes(id) ON DELETE SET NULL
    )
  `);

  // School Assignment Attachments (multiple files)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_assignment_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      uploaded_by INTEGER,
      file_url TEXT NOT NULL,
      file_name TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // School Submissions (student work)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      notes TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT CHECK(status IN ('submitted', 'approved', 'needs_revision')) DEFAULT 'submitted',
      FOREIGN KEY (assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(assignment_id, student_id)
    )
  `);

  // School Submission Attachments (multiple files)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_submission_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      uploaded_by INTEGER,
      file_url TEXT NOT NULL,
      file_name TEXT,
      file_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES school_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // School Feedback (teacher comments/approvals)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      comment TEXT NOT NULL,
      rating TEXT CHECK(rating IN ('excellent', 'very_good', 'good', 'needs_improvement')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (submission_id) REFERENCES school_submissions(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Quiz Questions (multiple choice questions attached to assignments)
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT CHECK(correct_answer IN ('a', 'b', 'c', 'd')) NOT NULL,
      points INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE
    )
  `);

  // Student Quiz Submissions
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      assignment_id INTEGER NOT NULL,
      selected_answer TEXT CHECK(selected_answer IN ('a', 'b', 'c', 'd')),
      is_correct BOOLEAN DEFAULT 0,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assignment_id) REFERENCES school_assignments(id) ON DELETE CASCADE,
      UNIQUE(question_id, student_id)
    )
  `);

  // Teacher-Parent Messages
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      subject TEXT,
      message TEXT NOT NULL,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // School Student Progress (track attendance, participation, grades per class)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_student_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      class_id INTEGER NOT NULL,
      attendance_percentage REAL DEFAULT 0,
      participation_score REAL DEFAULT 0,
      overall_grade TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      UNIQUE(student_id, class_id)
    )
  `);

  // School achievements/badges definitions
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      category TEXT CHECK(category IN ('quiz', 'assignment', 'attendance', 'special')) DEFAULT 'assignment',
      points INTEGER DEFAULT 10,
      requirement_type TEXT CHECK(requirement_type IN ('quiz_score', 'assignments_completed', 'quizzes_passed', 'streak', 'special')) DEFAULT 'special',
      requirement_value INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Student earned achievements
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      awarded_by INTEGER,
      notes TEXT,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES school_achievements(id) ON DELETE CASCADE,
      FOREIGN KEY (awarded_by) REFERENCES profiles(id),
      UNIQUE(student_id, achievement_id)
    )
  `);

  // Student points tracking for school
  db.exec(`
    CREATE TABLE IF NOT EXISTS student_school_points (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      points INTEGER DEFAULT 0,
      level INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(student_id)
    )
  `);

  // School indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_school_enrollments_student ON school_enrollments(student_id);
    CREATE INDEX IF NOT EXISTS idx_school_enrollments_class ON school_enrollments(class_id);
    CREATE INDEX IF NOT EXISTS idx_guardian_students_guardian ON guardian_students(guardian_id);
    CREATE INDEX IF NOT EXISTS idx_guardian_students_student ON guardian_students(student_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_teacher ON teacher_class_assignments(teacher_id);
    CREATE INDEX IF NOT EXISTS idx_teacher_class_assignments_class ON teacher_class_assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_school_assignments_class ON school_assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_school_submissions_assignment ON school_submissions(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_school_submissions_student ON school_submissions(student_id);
    CREATE INDEX IF NOT EXISTS idx_school_assignment_attachments_assignment ON school_assignment_attachments(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_school_submission_attachments_submission ON school_submission_attachments(submission_id);
  `);

  // ==================== CHURCH SCHOOL SUBJECTS ====================
  // Subjects for organizing church school assignments (Language, Religion, etc.)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📚',
      color TEXT DEFAULT 'indigo',
      description TEXT,
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_school_subjects_class ON school_subjects(class_id);
    CREATE INDEX IF NOT EXISTS idx_school_subjects_active ON school_subjects(is_active);
  `);

  console.log('✅ Church school subjects table created');

  // ==================== REGULAR SCHOOL (Home Tracking) ====================
  // Subjects created by parents for their children
  db.exec(`
    CREATE TABLE IF NOT EXISTS regular_school_subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '📚',
      color TEXT DEFAULT 'indigo',
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Homework items added by parents
  db.exec(`
    CREATE TABLE IF NOT EXISTS regular_school_homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL,
      student_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATE,
      points INTEGER DEFAULT 10,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed')),
      completed_at DATETIME,
      created_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (subject_id) REFERENCES regular_school_subjects(id) ON DELETE CASCADE,
      FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Indexes for regular school
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_regular_subjects_student ON regular_school_subjects(student_id);
    CREATE INDEX IF NOT EXISTS idx_regular_homework_student ON regular_school_homework(student_id);
    CREATE INDEX IF NOT EXISTS idx_regular_homework_subject ON regular_school_homework(subject_id);
    CREATE INDEX IF NOT EXISTS idx_regular_homework_due_date ON regular_school_homework(due_date);
  `);

  // Push notification subscriptions
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      endpoint TEXT NOT NULL UNIQUE,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Notifications log (for in-app notifications too)
  db.exec(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      data TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for notifications
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_push_subscriptions_profile ON push_subscriptions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_profile ON notifications(profile_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `);

  // Gamification: Water intake tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS water_intake (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      amount_ml INTEGER NOT NULL,
      logged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Gamification: Streaks tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS streaks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      streak_type TEXT NOT NULL,
      current_streak INTEGER DEFAULT 0,
      longest_streak INTEGER DEFAULT 0,
      last_activity_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(profile_id, streak_type)
    )
  `);

  // Gamification: Achievements definitions
  db.exec(`
    CREATE TABLE IF NOT EXISTS achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      icon TEXT NOT NULL,
      points_reward INTEGER DEFAULT 0,
      requirement_type TEXT NOT NULL,
      requirement_value INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Gamification: Profile achievements (earned)
  db.exec(`
    CREATE TABLE IF NOT EXISTS profile_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
      UNIQUE(profile_id, achievement_id)
    )
  `);

  // Gamification: Daily challenges
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      challenge_type TEXT NOT NULL,
      description TEXT NOT NULL,
      target_value INTEGER NOT NULL,
      bonus_points INTEGER DEFAULT 10,
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Insert default gamification achievements
  const gamificationAchievements = [
    { name: 'First Task', description: 'Complete your first task', icon: '🌟', points_reward: 10, requirement_type: 'tasks_completed', requirement_value: 1 },
    { name: 'Task Master', description: 'Complete 10 tasks', icon: '🏆', points_reward: 50, requirement_type: 'tasks_completed', requirement_value: 10 },
    { name: 'Super Achiever', description: 'Complete 50 tasks', icon: '👑', points_reward: 100, requirement_type: 'tasks_completed', requirement_value: 50 },
    { name: 'Week Warrior', description: 'Complete tasks 7 days in a row', icon: '🔥', points_reward: 75, requirement_type: 'streak_days', requirement_value: 7 },
    { name: 'Month Champion', description: 'Complete tasks 30 days in a row', icon: '💎', points_reward: 200, requirement_type: 'streak_days', requirement_value: 30 },
    { name: 'Hydration Hero', description: 'Log water intake 7 days in a row', icon: '💧', points_reward: 50, requirement_type: 'water_streak', requirement_value: 7 },
    { name: 'Goal Getter', description: 'Achieve your first monthly goal', icon: '🎯', points_reward: 100, requirement_type: 'goals_achieved', requirement_value: 1 },
    { name: 'Point Collector', description: 'Earn 500 total points', icon: '💰', points_reward: 50, requirement_type: 'total_points', requirement_value: 500 },
    { name: 'Star Student', description: 'Earn 100 stars', icon: '⭐', points_reward: 75, requirement_type: 'total_stars', requirement_value: 100 }
  ];

  const insertGamificationAchievement = db.prepare(`
    INSERT OR IGNORE INTO achievements (name, description, icon, points_reward, requirement_type, requirement_value)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const ach of gamificationAchievements) {
    insertGamificationAchievement.run(ach.name, ach.description, ach.icon, ach.points_reward, ach.requirement_type, ach.requirement_value);
  }

  // Insert default achievements
  const defaultAchievements = [
    { name: 'First Steps', description: 'Complete your first assignment', icon: '🎯', category: 'assignment', points: 5, requirement_type: 'assignments_completed', requirement_value: 1 },
    { name: 'Quiz Master', description: 'Score 100% on a quiz', icon: '🏆', category: 'quiz', points: 20, requirement_type: 'quiz_score', requirement_value: 100 },
    { name: 'Consistent Learner', description: 'Complete 5 assignments', icon: '📚', category: 'assignment', points: 25, requirement_type: 'assignments_completed', requirement_value: 5 },
    { name: 'Psalm Singer', description: 'Complete 3 psalm assignments', icon: '🎵', category: 'assignment', points: 15, requirement_type: 'special', requirement_value: 3 },
    { name: 'Geez Scholar', description: 'Complete 5 alphabet assignments', icon: '✍️', category: 'assignment', points: 20, requirement_type: 'special', requirement_value: 5 },
    { name: 'Video Watcher', description: 'Complete 3 video lessons', icon: '🎬', category: 'assignment', points: 10, requirement_type: 'special', requirement_value: 3 },
    { name: 'Perfect Week', description: 'Submit all assignments in a week', icon: '⭐', category: 'streak', points: 30, requirement_type: 'streak', requirement_value: 7 },
    { name: 'Rising Star', description: 'Earn 50 points', icon: '🌟', category: 'special', points: 10, requirement_type: 'special', requirement_value: 50 },
    { name: 'Super Student', description: 'Earn 100 points', icon: '💫', category: 'special', points: 25, requirement_type: 'special', requirement_value: 100 },
    { name: 'Church Scholar', description: 'Earn 200 points', icon: '👑', category: 'special', points: 50, requirement_type: 'special', requirement_value: 200 }
  ];

  const insertAchievement = db.prepare(`
    INSERT OR IGNORE INTO school_achievements (name, description, icon, category, points, requirement_type, requirement_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ach of defaultAchievements) {
    insertAchievement.run(ach.name, ach.description, ach.icon, ach.category, ach.points, ach.requirement_type, ach.requirement_value);
  }

  // Insert default school classes
  const defaultClasses = [
    { name: 'First Class', description: 'Youngest students learning basics', age_min: 5, age_max: 7 },
    { name: 'Second Class', description: 'Intermediate students', age_min: 8, age_max: 10 },
    { name: 'Third Class', description: 'Advanced students', age_min: 11, age_max: 14 }
  ];

  const existingClasses = db.prepare('SELECT COUNT(*) as count FROM school_classes').get() as { count: number };
  if (existingClasses.count === 0) {
    console.log('📚 Creating default school classes...');
    const insertClass = db.prepare('INSERT INTO school_classes (name, description, age_min, age_max) VALUES (?, ?, ?, ?)');
    defaultClasses.forEach(cls => {
      insertClass.run(cls.name, cls.description, cls.age_min, cls.age_max);
    });
    console.log('✅ Default school classes created');
  }

  // Migration: Add custom_instructions column if it doesn't exist
  try {
    const tableInfo: any[] = db.prepare('PRAGMA table_info(ai_settings)').all();
    const hasCustomInstructions = tableInfo.some((col: any) => col.name === 'custom_instructions');

    if (!hasCustomInstructions) {
      console.log('🔄 Migrating ai_settings table: adding custom_instructions column...');
      db.prepare('ALTER TABLE ai_settings ADD COLUMN custom_instructions TEXT DEFAULT \'\'').run();
      console.log('✅ Migration completed: custom_instructions column added');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // Migration: Add parent_id column to profiles table for parent-child relationships
  try {
    const profileInfo: any[] = db.prepare('PRAGMA table_info(profiles)').all();
    const hasParentId = profileInfo.some((col: any) => col.name === 'parent_id');

    if (!hasParentId) {
      console.log('🔄 Migrating profiles table: adding parent_id column for family relationships...');
      db.prepare('ALTER TABLE profiles ADD COLUMN parent_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON profiles(parent_id)').run();
      console.log('✅ Migration completed: parent_id column added');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }

  // Migration: Update profiles table to support 'admin' type and convert Robel to admin
  try {
    const robel: any = db.prepare('SELECT id, name, type FROM profiles WHERE id = 1').get();

    if (robel && robel.type !== 'admin') {
      console.log('🔄 Migrating profiles table to support admin role...');

      // Check if we need to migrate the table schema
      db.exec(`
        -- Create new table with updated CHECK constraint
        CREATE TABLE IF NOT EXISTS profiles_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('admin', 'parent', 'child', 'teacher')),
          age INTEGER,
          gender TEXT CHECK(gender IN ('male', 'female', 'other')),
          avatar TEXT,
          pin TEXT,
          settings TEXT DEFAULT '{}',
          parent_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        -- Copy data, converting Robel (ID 1) to admin
        INSERT INTO profiles_new
        SELECT
          id,
          name,
          CASE WHEN id = 1 THEN 'admin' ELSE type END as type,
          age,
          gender,
          avatar,
          pin,
          settings,
          parent_id,
          created_at,
          updated_at
        FROM profiles;

        -- Drop old table
        DROP TABLE profiles;

        -- Rename new table
        ALTER TABLE profiles_new RENAME TO profiles;

        -- Recreate index
        CREATE INDEX IF NOT EXISTS idx_profiles_parent_id ON profiles(parent_id);
      `);

      console.log('✅ Migration completed: Profiles table updated and Robel is now an admin');
    } else if (robel && robel.type === 'admin') {
      console.log('✓ User Robel (ID: 1) is already an admin');
    }
  } catch (error: any) {
    console.error('Migration error (Robel to admin):', error.message);
  }

  // Migration: Add ai_enabled column to profiles table for AI access control
  try {
    const profileInfo: any[] = db.prepare('PRAGMA table_info(profiles)').all();
    const hasAiEnabled = profileInfo.some((col: any) => col.name === 'ai_enabled');

    if (!hasAiEnabled) {
      console.log('🔄 Migrating profiles table: adding ai_enabled column for AI access control...');
      // Default: AI enabled for everyone
      db.prepare('ALTER TABLE profiles ADD COLUMN ai_enabled INTEGER DEFAULT 1').run();
      console.log('✅ Migration completed: ai_enabled column added');
    }
  } catch (error: any) {
    console.error('Migration error (ai_enabled):', error.message);
  }

  // Migration: Enable AI for all existing profiles that have it disabled
  // This fixes profiles created before AI was enabled by default
  // IMPORTANT: This is a ONE-TIME migration - we track it in settings to avoid overwriting admin decisions
  try {
    const migrationKey = 'migration_ai_enabled_initial';
    const migrationRun: any = db.prepare('SELECT value FROM settings WHERE key = ?').get(migrationKey);

    if (!migrationRun) {
      // Only enable AI for profiles that have NULL (never set) - respect explicit admin decisions (0)
      const result = db.prepare('UPDATE profiles SET ai_enabled = 1 WHERE ai_enabled IS NULL').run();
      if (result.changes > 0) {
        console.log(`✅ Enabled AI for ${result.changes} profiles (one-time migration)`);
      }
      // Mark migration as complete so it never runs again
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(migrationKey, 'completed');
    }
  } catch (error: any) {
    console.error('Migration error (enable AI for existing profiles):', error.message);
  }

  // Migration: Add diet_enabled column to profiles table for Diet access control
  try {
    const profileInfo: any[] = db.prepare('PRAGMA table_info(profiles)').all();
    const hasDietEnabled = profileInfo.some((col: any) => col.name === 'diet_enabled');

    if (!hasDietEnabled) {
      console.log('🔄 Migrating profiles table: adding diet_enabled column for Diet access control...');
      // Default: Diet disabled for everyone, admin can enable it per profile
      db.prepare('ALTER TABLE profiles ADD COLUMN diet_enabled INTEGER DEFAULT 0').run();
      console.log('✅ Migration completed: diet_enabled column added');
    }
  } catch (error: any) {
    console.error('Migration error (diet_enabled):', error.message);
  }

  // Migration: Add food_items column to meal_logs for AI-generated meal entries
  try {
    const mealLogInfo: any[] = db.prepare('PRAGMA table_info(meal_logs)').all();
    const hasFoodItems = mealLogInfo.some((col: any) => col.name === 'food_items');

    if (!hasFoodItems) {
      console.log('🔄 Migrating meal_logs table: adding food_items column for AI-generated entries...');
      db.prepare('ALTER TABLE meal_logs ADD COLUMN food_items TEXT').run();
      console.log('✅ Migration completed: food_items column added to meal_logs');
    }
  } catch (error: any) {
    console.error('Migration error (meal_logs food_items):', error.message);
  }

  // Migration: Hash any plain text PINs for security
  try {
    const profiles: any[] = db.prepare('SELECT id, name, pin FROM profiles WHERE pin IS NOT NULL').all();
    let hashedCount = 0;

    for (const profile of profiles) {
      // Check if PIN is plain text (not bcrypt hashed)
      const isPlainText = !profile.pin.startsWith('$2');

      if (isPlainText) {
        console.log(`🔐 Encrypting plain text PIN for ${profile.name}...`);
        const hashedPin = bcrypt.hashSync(profile.pin, 10);
        db.prepare('UPDATE profiles SET pin = ? WHERE id = ?').run(hashedPin, profile.id);
        hashedCount++;
      }
    }

    if (hashedCount > 0) {
      console.log(`✅ Migration completed: Encrypted ${hashedCount} plain text PINs with bcrypt`);
    }
  } catch (error: any) {
    console.error('Migration error (PIN encryption):', error.message);
  }

  // Migration: Add password column for adults (separate from PIN for kids)
  try {
    const profileInfo: any[] = db.prepare('PRAGMA table_info(profiles)').all();
    const hasPassword = profileInfo.some((col: any) => col.name === 'password');

    if (!hasPassword) {
      console.log('🔄 Migrating profiles table: adding password column for adult authentication...');
      db.prepare('ALTER TABLE profiles ADD COLUMN password TEXT').run();
      console.log('✅ Migration completed: password column added');
      console.log('ℹ️  Note: Adults (parent/teacher/admin) should use password field, kids use PIN field');
    }
  } catch (error: any) {
    console.error('Migration error (password column):', error.message);
  }

  // Migration: Add username column for unique login identifiers
  try {
    const profileInfo: any[] = db.prepare('PRAGMA table_info(profiles)').all();
    const hasUsername = profileInfo.some((col: any) => col.name === 'username');

    if (!hasUsername) {
      console.log('🔄 Migrating profiles table: adding username column for login...');

      // Step 1: Add column without UNIQUE constraint (SQLite limitation)
      db.prepare('ALTER TABLE profiles ADD COLUMN username TEXT').run();

      // Step 2: Auto-generate usernames from names for existing users (lowercase, no spaces)
      const existingProfiles: any[] = db.prepare('SELECT id, name FROM profiles').all();
      for (const profile of existingProfiles) {
        const username = profile.name.toLowerCase().replace(/\s+/g, '');
        db.prepare('UPDATE profiles SET username = ? WHERE id = ?').run(username, profile.id);
      }

      // Step 3: Create unique index on username column
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username)').run();

      console.log('✅ Migration completed: username column added and auto-generated for existing users');
    }
  } catch (error: any) {
    console.error('Migration error (username column):', error.message);
  }

  // Migration: Add parent approval columns to monthly_goals table
  try {
    const goalsInfo: any[] = db.prepare('PRAGMA table_info(monthly_goals)').all();
    const hasParentApproved = goalsInfo.some((col: any) => col.name === 'parent_approved');
    const hasCreatedBy = goalsInfo.some((col: any) => col.name === 'created_by');
    const hasApprovedBy = goalsInfo.some((col: any) => col.name === 'approved_by');

    if (!hasParentApproved) {
      console.log('🔄 Migrating monthly_goals table: adding parent approval columns...');
      db.prepare('ALTER TABLE monthly_goals ADD COLUMN parent_approved BOOLEAN DEFAULT 0').run();
      console.log('✅ Added parent_approved column');
    }

    if (!hasCreatedBy) {
      db.prepare('ALTER TABLE monthly_goals ADD COLUMN created_by INTEGER REFERENCES profiles(id)').run();
      console.log('✅ Added created_by column');
    }

    if (!hasApprovedBy) {
      db.prepare('ALTER TABLE monthly_goals ADD COLUMN approved_by INTEGER REFERENCES profiles(id)').run();
      console.log('✅ Added approved_by column');
    }

    if (!hasParentApproved || !hasCreatedBy || !hasApprovedBy) {
      console.log('✅ Migration completed: monthly_goals table updated with parent approval fields');
    }
  } catch (error: any) {
    console.error('Migration error (monthly_goals approval):', error.message);
  }

  // Migration: Add parent approval columns to tasks table
  try {
    const tasksInfo: any[] = db.prepare('PRAGMA table_info(tasks)').all();
    const hasParentApproved = tasksInfo.some((col: any) => col.name === 'parent_approved');
    const hasApprovedBy = tasksInfo.some((col: any) => col.name === 'approved_by');

    if (!hasParentApproved) {
      console.log('🔄 Migrating tasks table: adding parent approval columns...');
      db.prepare('ALTER TABLE tasks ADD COLUMN parent_approved BOOLEAN DEFAULT 0').run();
      console.log('✅ Added parent_approved column to tasks');
    }

    if (!hasApprovedBy) {
      db.prepare('ALTER TABLE tasks ADD COLUMN approved_by INTEGER REFERENCES profiles(id)').run();
      console.log('✅ Added approved_by column to tasks');
    }

    if (!hasParentApproved || !hasApprovedBy) {
      console.log('✅ Migration completed: tasks table updated with parent approval fields');
    }
  } catch (error: any) {
    console.error('Migration error (tasks approval):', error.message);
  }

  // Migration: Add assigned_class_id to profiles for teachers
  try {
    const profileColumns = db.prepare("PRAGMA table_info(profiles)").all() as { name: string }[];
    const hasAssignedClassId = profileColumns.some(col => col.name === 'assigned_class_id');

    if (!hasAssignedClassId) {
      db.prepare('ALTER TABLE profiles ADD COLUMN assigned_class_id INTEGER REFERENCES school_classes(id)').run();
      console.log('✅ Added assigned_class_id column to profiles for teacher class assignment');
    }
  } catch (error: any) {
    console.error('Migration error (assigned_class_id):', error.message);
  }

  // Migration: Add linked_quiz_id to school_assignments for quiz linkage
  try {
    const assignmentColumns = db.prepare('PRAGMA table_info(school_assignments)').all() as { name: string }[];
    const hasLinkedQuizId = assignmentColumns.some(col => col.name === 'linked_quiz_id');

    if (!hasLinkedQuizId) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN linked_quiz_id INTEGER').run();
      console.log('? Added linked_quiz_id column to school_assignments for quiz linkage');
    }
  } catch (error: any) {
    console.error('Migration error (linked_quiz_id):', error.message);
  }

  // Migration: Backfill school_assignments columns for legacy schemas
  try {
    const assignmentColumns = db.prepare('PRAGMA table_info(school_assignments)').all() as { name: string }[];
    const columnNames = assignmentColumns.map(col => col.name);

    if (!columnNames.includes('teacher_id')) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN teacher_id INTEGER').run();
      console.log('? Added teacher_id column to school_assignments');
      db.prepare('UPDATE school_assignments SET teacher_id = 1 WHERE teacher_id IS NULL').run();
    }

    if (!columnNames.includes('type')) {
      db.prepare("ALTER TABLE school_assignments ADD COLUMN type TEXT DEFAULT 'homework'").run();
      console.log('? Added type column to school_assignments');
    }

    if (!columnNames.includes('youtube_link')) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN youtube_link TEXT').run();
      console.log('? Added youtube_link column to school_assignments');
    }

    if (!columnNames.includes('attachment_url')) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN attachment_url TEXT').run();
      console.log('? Added attachment_url column to school_assignments');
    }

    if (!columnNames.includes('updated_at')) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP').run();
      console.log('? Added updated_at column to school_assignments');
    }
  } catch (error: any) {
    console.error('Migration error (school_assignments columns):', error.message);
  }

  // Migration: Add subject_id to school_assignments for subject-based organization
  try {
    const assignmentCols = db.prepare('PRAGMA table_info(school_assignments)').all() as { name: string }[];
    const hasSubjectId = assignmentCols.some(col => col.name === 'subject_id');

    if (!hasSubjectId) {
      db.prepare('ALTER TABLE school_assignments ADD COLUMN subject_id INTEGER REFERENCES school_subjects(id) ON DELETE SET NULL').run();
      console.log('✅ Added subject_id column to school_assignments');
    }
  } catch (error: any) {
    console.error('Migration error (school_assignments subject_id):', error.message);
  }

  // Migration: Ensure school-only mode setting exists
  try {
    const existingSetting: any = db.prepare('SELECT 1 FROM settings WHERE key = ?').get('school_only_mode');
    if (!existingSetting) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('school_only_mode', 'false');
      console.log('? Added school_only_mode setting (default false)');
    }
  } catch (error: any) {
    console.error('Migration error (school_only_mode setting):', error.message);
  }

  // Migration: Ensure ALL features are enabled for ALL profiles
  // This runs on every startup to ensure no features are missing
  try {
    const profiles: any[] = db.prepare('SELECT id FROM profiles').all();
    const upsertFeature = db.prepare(`
      INSERT INTO profile_features (profile_id, feature_key, enabled)
      VALUES (?, ?, 1)
      ON CONFLICT(profile_id, feature_key) DO NOTHING
    `);

    let insertedCount = 0;
    profiles.forEach(profile => {
      FEATURE_KEYS.forEach(featureKey => {
        const result = upsertFeature.run(profile.id, featureKey);
        if (result.changes > 0) insertedCount++;
      });
    });

    if (insertedCount > 0) {
      console.log(`✅ Enabled ${insertedCount} missing feature entries for profiles`);
    }
  } catch (error: any) {
    console.error('Migration error (profile feature seed):', error.message);
  }

  // Migration: Populate guardian_students from legacy parent_id
  try {
    const parentLinks: any[] = db.prepare('SELECT id, parent_id FROM profiles WHERE parent_id IS NOT NULL').all();
    const insertGuardian = db.prepare(`
      INSERT OR IGNORE INTO guardian_students (guardian_id, student_id, relationship)
      VALUES (?, ?, 'parent')
    `);
    parentLinks.forEach(link => {
      insertGuardian.run(link.parent_id, link.id);
    });
  } catch (error: any) {
    console.error('Migration error (guardian_students backfill):', error.message);
  }

  // Migration: Populate teacher_class_assignments from assigned_class_id
  try {
    db.prepare(`
      INSERT OR IGNORE INTO teacher_class_assignments (teacher_id, class_id)
      SELECT id, assigned_class_id FROM profiles
      WHERE type = 'teacher' AND assigned_class_id IS NOT NULL
    `).run();
  } catch (error: any) {
    console.error('Migration error (teacher_class_assignments backfill):', error.message);
  }

  // Migration: Remove category CHECK constraint from tasks table to allow custom categories
  try {
    // Check if current table has the strict CHECK constraint by checking column info
    const tasksInfo: any[] = db.prepare('PRAGMA table_info(tasks)').all();
    const categoryCol = tasksInfo.find((col: any) => col.name === 'category');

    // If category column exists, we need to recreate the table without the CHECK constraint
    // We'll detect this by trying to insert a custom category - if it fails, we migrate
    try {
      // Test if we can insert custom category
      const testResult = db.prepare(`
        INSERT INTO tasks (profile_id, title, category, points, difficulty)
        VALUES (1, 'test_migration_check', 'custom-test-category', 10, 'easy')
      `).run();
      // Clean up test row
      db.prepare('DELETE FROM tasks WHERE title = ?').run('test_migration_check');
      console.log('✓ Tasks table already supports custom categories');
    } catch (checkError: any) {
      if (checkError.message.includes('CHECK constraint')) {
        console.log('🔄 Migrating tasks table: removing category CHECK constraint to allow custom categories...');

        // Create new table without category CHECK constraint
        db.exec(`
          CREATE TABLE IF NOT EXISTS tasks_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            profile_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            category TEXT,
            points INTEGER DEFAULT 10,
            difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
            earns_points BOOLEAN DEFAULT 1,
            is_recurring BOOLEAN DEFAULT 0,
            recurrence_pattern TEXT,
            due_date DATETIME,
            completed BOOLEAN DEFAULT 0,
            completed_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            parent_approved BOOLEAN DEFAULT 0,
            approved_by INTEGER,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
            FOREIGN KEY (created_by) REFERENCES profiles(id),
            FOREIGN KEY (approved_by) REFERENCES profiles(id)
          )
        `);

        // Copy data - check which columns exist in old table
        const oldTasksInfo: any[] = db.prepare('PRAGMA table_info(tasks)').all();
        const oldColumns = oldTasksInfo.map((col: any) => col.name);

        // Build column list based on what exists
        const hasEarnsPoints = oldColumns.includes('earns_points');
        const hasIsRecurring = oldColumns.includes('is_recurring');
        const hasRecurrencePattern = oldColumns.includes('recurrence_pattern');
        const hasDueDate = oldColumns.includes('due_date');
        const hasCreatedBy = oldColumns.includes('created_by');
        const hasParentApproved = oldColumns.includes('parent_approved');
        const hasApprovedBy = oldColumns.includes('approved_by');

        db.exec(`
          INSERT INTO tasks_new (id, profile_id, title, description, category, points, difficulty,
                 earns_points, is_recurring, recurrence_pattern, due_date, completed, completed_at,
                 created_at, created_by, parent_approved, approved_by)
          SELECT id, profile_id, title, description, category, points, difficulty,
                 ${hasEarnsPoints ? 'earns_points' : '1'},
                 ${hasIsRecurring ? 'is_recurring' : '0'},
                 ${hasRecurrencePattern ? 'recurrence_pattern' : 'NULL'},
                 ${hasDueDate ? 'due_date' : 'NULL'},
                 completed, completed_at, created_at,
                 ${hasCreatedBy ? 'created_by' : 'NULL'},
                 ${hasParentApproved ? 'parent_approved' : '0'},
                 ${hasApprovedBy ? 'approved_by' : 'NULL'}
          FROM tasks
        `);

        // Drop old table and rename
        db.exec('DROP TABLE tasks');
        db.exec('ALTER TABLE tasks_new RENAME TO tasks');

        // Recreate indexes
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_tasks_profile ON tasks(profile_id);
          CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
          CREATE INDEX IF NOT EXISTS idx_tasks_parent_approved ON tasks(parent_approved);
        `);

        console.log('✅ Migration completed: tasks table now supports custom categories');
      }
    }
  } catch (error: any) {
    console.error('Migration error (tasks category constraint):', error.message);
  }

  // Migration: Add category column to notes table
  try {
    const notesInfo: any[] = db.prepare('PRAGMA table_info(notes)').all();
    const hasCategory = notesInfo.some((col: any) => col.name === 'category');

    if (!hasCategory) {
      console.log('🔄 Migrating notes table: adding category column...');
      db.prepare('ALTER TABLE notes ADD COLUMN category TEXT').run();
      console.log('✅ Migration completed: category column added to notes');
    }
  } catch (error: any) {
    console.error('Migration error (notes category):', error.message);
  }

  // Migration: Add 'quiz' type to school_assignments CHECK constraint
  try {
    // Try to insert a 'quiz' type assignment - if it fails, we need to migrate
    try {
      const testResult = db.prepare(`
        INSERT INTO school_assignments (class_id, teacher_id, title, type)
        VALUES (1, 1, 'test_migration_quiz_check', 'quiz')
      `).run();
      // Clean up test row
      db.prepare('DELETE FROM school_assignments WHERE title = ?').run('test_migration_quiz_check');
      console.log('✓ school_assignments table already supports quiz type');
    } catch (checkError: any) {
      if (checkError.message.includes('CHECK constraint')) {
        console.log('🔄 Migrating school_assignments table: adding quiz type support...');

        // Create new table with quiz in CHECK constraint
        db.exec(`
          CREATE TABLE IF NOT EXISTS school_assignments_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            class_id INTEGER NOT NULL,
            teacher_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT CHECK(type IN ('homework', 'psalm', 'alphabet', 'video', 'quiz', 'other')) DEFAULT 'homework',
            youtube_link TEXT,
            attachment_url TEXT,
            due_date DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
            FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE
          )
        `);

        // Copy data
        db.exec(`
          INSERT INTO school_assignments_new
          SELECT * FROM school_assignments
        `);

        // Drop old table and rename
        db.exec('DROP TABLE school_assignments');
        db.exec('ALTER TABLE school_assignments_new RENAME TO school_assignments');

        console.log('✅ Migration completed: school_assignments now supports quiz type');
      }
    }
  } catch (error: any) {
    console.error('Migration error (school_assignments quiz type):', error.message);
  }

  // Migration: Add tags column to notes table
  try {
    const notesInfo: any[] = db.prepare('PRAGMA table_info(notes)').all();
    const hasTags = notesInfo.some((col: any) => col.name === 'tags');

    if (!hasTags) {
      console.log('🔄 Migrating notes table: adding tags column...');
      db.prepare('ALTER TABLE notes ADD COLUMN tags TEXT').run();
      console.log('✅ Migration completed: tags column added to notes');
    }
  } catch (error: any) {
    console.error('Migration error (notes tags):', error.message);
  }

  // Migration: Add is_pinned and reminder_at columns to notes table
  try {
    const notesInfo: any[] = db.prepare('PRAGMA table_info(notes)').all();
    const hasIsPinned = notesInfo.some((col: any) => col.name === 'is_pinned');
    const hasReminderAt = notesInfo.some((col: any) => col.name === 'reminder_at');

    if (!hasIsPinned) {
      console.log('🔄 Migrating notes table: adding is_pinned column...');
      db.prepare('ALTER TABLE notes ADD COLUMN is_pinned INTEGER DEFAULT 0').run();
      console.log('✅ Migration completed: is_pinned column added to notes');
    }

    if (!hasReminderAt) {
      console.log('🔄 Migrating notes table: adding reminder_at column...');
      db.prepare('ALTER TABLE notes ADD COLUMN reminder_at DATETIME').run();
      console.log('✅ Migration completed: reminder_at column added to notes');
    }
  } catch (error: any) {
    console.error('Migration error (notes is_pinned/reminder_at):', error.message);
  }

  // Migration: Add goal_category, reward_image, current_points to monthly_goals table
  try {
    const goalsInfo: any[] = db.prepare('PRAGMA table_info(monthly_goals)').all();
    const hasCategory = goalsInfo.some((col: any) => col.name === 'goal_category');
    const hasRewardImage = goalsInfo.some((col: any) => col.name === 'reward_image');
    const hasCurrentPoints = goalsInfo.some((col: any) => col.name === 'current_points');

    if (!hasCategory) {
      console.log('Migrating monthly_goals table: adding goal_category column...');
      db.prepare("ALTER TABLE monthly_goals ADD COLUMN goal_category TEXT DEFAULT 'monthly'").run();
      console.log('Migration completed: goal_category column added');
    }

    if (!hasRewardImage) {
      console.log('Migrating monthly_goals table: adding reward_image column...');
      db.prepare('ALTER TABLE monthly_goals ADD COLUMN reward_image TEXT').run();
      console.log('Migration completed: reward_image column added');
    }

    if (!hasCurrentPoints) {
      console.log('Migrating monthly_goals table: adding current_points column...');
      db.prepare('ALTER TABLE monthly_goals ADD COLUMN current_points INTEGER DEFAULT 0').run();
      console.log('Migration completed: current_points column added');
    }
  } catch (error: any) {
    console.error('Migration error (monthly_goals enhancements):', error.message);
  }

  // Create goal_milestones table for milestone rewards
  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      milestone_points INTEGER NOT NULL,
      milestone_reward TEXT NOT NULL,
      achieved BOOLEAN DEFAULT 0,
      achieved_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (goal_id) REFERENCES monthly_goals(id) ON DELETE CASCADE
    )
  `);

  // Daily login bonuses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS login_bonuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      login_date TEXT NOT NULL,
      consecutive_days INTEGER DEFAULT 1,
      points_earned INTEGER NOT NULL,
      claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(profile_id, login_date)
    )
  `);

  // Streak freezes (protect streaks when sick/busy)
  db.exec(`
    CREATE TABLE IF NOT EXISTS streak_freezes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      freeze_date TEXT NOT NULL,
      streak_type TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Power-ups inventory
  db.exec(`
    CREATE TABLE IF NOT EXISTS power_ups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      power_up_type TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      expires_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Mystery rewards log (for random bonus tracking)
  db.exec(`
    CREATE TABLE IF NOT EXISTS mystery_rewards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      reward_type TEXT NOT NULL,
      multiplier REAL DEFAULT 1.0,
      bonus_points INTEGER DEFAULT 0,
      task_id INTEGER,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for new tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_login_bonuses_profile ON login_bonuses(profile_id);
    CREATE INDEX IF NOT EXISTS idx_login_bonuses_date ON login_bonuses(login_date);
    CREATE INDEX IF NOT EXISTS idx_streak_freezes_profile ON streak_freezes(profile_id);
    CREATE INDEX IF NOT EXISTS idx_power_ups_profile ON power_ups(profile_id);
    CREATE INDEX IF NOT EXISTS idx_mystery_rewards_profile ON mystery_rewards(profile_id);
  `);

  // ==================== AI PERSONALIZED GAMIFICATION ====================

  // AI-generated suggestions awaiting parent approval
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      suggestion_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      reasoning TEXT,
      difficulty TEXT DEFAULT 'medium',
      points_reward INTEGER DEFAULT 0,
      bonus_multiplier REAL DEFAULT 1.0,
      target_value INTEGER,
      duration_days INTEGER DEFAULT 7,
      expires_at DATETIME,
      status TEXT DEFAULT 'pending',
      parent_response TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      reviewed_by INTEGER,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Custom challenges (approved AI suggestions or parent-created)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      challenge_type TEXT DEFAULT 'custom',
      target_value INTEGER DEFAULT 1,
      current_progress INTEGER DEFAULT 0,
      points_reward INTEGER DEFAULT 0,
      bonus_multiplier REAL DEFAULT 1.0,
      difficulty TEXT DEFAULT 'medium',
      is_ai_generated BOOLEAN DEFAULT 0,
      ai_suggestion_id INTEGER,
      created_by INTEGER,
      starts_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
      FOREIGN KEY (ai_suggestion_id) REFERENCES ai_suggestions(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add timer columns to custom_challenges for existing databases
  try {
    db.exec(`ALTER TABLE custom_challenges ADD COLUMN requires_timer BOOLEAN DEFAULT 0`);
  } catch (e) { /* Column already exists */ }
  try {
    db.exec(`ALTER TABLE custom_challenges ADD COLUMN timer_duration INTEGER DEFAULT 300`);
  } catch (e) { /* Column already exists */ }

  // Custom achievements (parent-created or AI-suggested)
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      icon TEXT DEFAULT '🏆',
      points_reward INTEGER DEFAULT 0,
      requirement_description TEXT,
      is_global BOOLEAN DEFAULT 0,
      is_ai_generated BOOLEAN DEFAULT 0,
      ai_suggestion_id INTEGER,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
      FOREIGN KEY (ai_suggestion_id) REFERENCES ai_suggestions(id) ON DELETE SET NULL
    )
  `);

  // Track earned custom achievements
  db.exec(`
    CREATE TABLE IF NOT EXISTS custom_achievement_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      earned BOOLEAN DEFAULT 0,
      earned_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (achievement_id) REFERENCES custom_achievements(id) ON DELETE CASCADE,
      UNIQUE(profile_id, achievement_id)
    )
  `);

  // Behavior analysis cache (stores computed insights)
  db.exec(`
    CREATE TABLE IF NOT EXISTS behavior_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      insights_json TEXT NOT NULL,
      last_analyzed DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Parent focus areas (what parents want AI to emphasize)
  db.exec(`
    CREATE TABLE IF NOT EXISTS parent_focus_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      focus_type TEXT NOT NULL,
      priority INTEGER DEFAULT 1,
      notes TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for AI gamification tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_suggestions_profile ON ai_suggestions(profile_id);
    CREATE INDEX IF NOT EXISTS idx_ai_suggestions_status ON ai_suggestions(status);
    CREATE INDEX IF NOT EXISTS idx_custom_challenges_profile ON custom_challenges(profile_id);
    CREATE INDEX IF NOT EXISTS idx_custom_achievements_profile ON custom_achievements(profile_id);
    CREATE INDEX IF NOT EXISTS idx_behavior_insights_profile ON behavior_insights(profile_id);
  `);

  // ==================== ECONOMY CONTROLS & ANTI-ABUSE ====================
  // Parent-configurable earning limits and rate limiting
  db.exec(`
    CREATE TABLE IF NOT EXISTS economy_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      daily_points_cap INTEGER DEFAULT 200,
      weekly_points_cap INTEGER DEFAULT 1000,
      points_multiplier REAL DEFAULT 1.0,
      require_time_elapsed BOOLEAN DEFAULT 1,
      min_task_duration_minutes INTEGER DEFAULT 5,
      cooldown_seconds INTEGER DEFAULT 10,
      bonuses_enabled BOOLEAN DEFAULT 1,
      spin_wheel_enabled BOOLEAN DEFAULT 1,
      countdown_challenges_enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Track daily/weekly earnings for cap enforcement
  db.exec(`
    CREATE TABLE IF NOT EXISTS earning_tracker (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      tasks_completed INTEGER DEFAULT 0,
      bonuses_claimed INTEGER DEFAULT 0,
      last_action_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(profile_id, date),
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Rate limiting - track last point-earning action per profile
  db.exec(`
    CREATE TABLE IF NOT EXISTS rate_limit_tracker (
      profile_id INTEGER PRIMARY KEY,
      last_task_complete_at DATETIME,
      last_bonus_claim_at DATETIME,
      last_spin_at DATETIME,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Points adjustments - audit log for parent point adjustments (add/deduct)
  db.exec(`
    CREATE TABLE IF NOT EXISTS points_adjustments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      adjusted_by INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (adjusted_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);
  console.log('✅ Points adjustments table created');

  // Migration: Add related_task_id column to points_adjustments
  try {
    const adjustmentColumns = db.prepare('PRAGMA table_info(points_adjustments)').all() as any[];
    const hasRelatedTaskId = adjustmentColumns.some((col: any) => col.name === 'related_task_id');

    if (!hasRelatedTaskId) {
      console.log('🔄 Migrating points_adjustments table: adding related_task_id...');
      db.prepare('ALTER TABLE points_adjustments ADD COLUMN related_task_id INTEGER DEFAULT NULL').run();
      console.log('✅ Added related_task_id column to points_adjustments');
    }
  } catch (error: any) {
    console.error('Migration error (points_adjustments):', error.message);
  }

  // Create indexes for economy tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_economy_settings_profile ON economy_settings(profile_id);
    CREATE INDEX IF NOT EXISTS idx_earning_tracker_profile ON earning_tracker(profile_id);
    CREATE INDEX IF NOT EXISTS idx_earning_tracker_date ON earning_tracker(date);
  `);

  // ==================== COUNTDOWN CHALLENGES ====================
  // Time-limited challenges with bonus multipliers
  db.exec(`
    CREATE TABLE IF NOT EXISTS countdown_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      target_tasks INTEGER NOT NULL DEFAULT 3,
      completed_tasks INTEGER DEFAULT 0,
      duration_minutes INTEGER NOT NULL DEFAULT 120,
      bonus_multiplier REAL DEFAULT 2.0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      completed BOOLEAN DEFAULT 0,
      completed_at DATETIME,
      bonus_points_awarded INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Create index for countdown challenges
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_countdown_challenges_profile ON countdown_challenges(profile_id);
    CREATE INDEX IF NOT EXISTS idx_countdown_challenges_expires ON countdown_challenges(expires_at);
  `);

  // ==================== LUCKY SPIN WHEEL ====================
  // Track spin eligibility and history
  db.exec(`
    CREATE TABLE IF NOT EXISTS spin_wheel_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL UNIQUE,
      tasks_since_last_spin INTEGER DEFAULT 0,
      tasks_required_for_spin INTEGER DEFAULT 5,
      total_spins INTEGER DEFAULT 0,
      last_spin_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS spin_wheel_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      reward_type TEXT NOT NULL,
      reward_value INTEGER NOT NULL,
      reward_description TEXT NOT NULL,
      spun_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for spin wheel
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_spin_wheel_progress_profile ON spin_wheel_progress(profile_id);
    CREATE INDEX IF NOT EXISTS idx_spin_wheel_history_profile ON spin_wheel_history(profile_id);
  `);

  // ==================== TASK TIMER SUPPORT ====================
  // Add timer columns to tasks table for timed tasks
  try {
    const tasksInfo: any[] = db.prepare('PRAGMA table_info(tasks)').all();
    const hasRequiresTimer = tasksInfo.some((col: any) => col.name === 'requires_timer');
    const hasTimerDuration = tasksInfo.some((col: any) => col.name === 'timer_duration_minutes');
    const hasLastCompletedDate = tasksInfo.some((col: any) => col.name === 'last_completed_date');

    if (!hasRequiresTimer) {
      console.log('🔄 Migrating tasks table: adding requires_timer column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN requires_timer INTEGER DEFAULT 0').run();
      console.log('✅ Added requires_timer column to tasks');
    }

    if (!hasTimerDuration) {
      console.log('🔄 Migrating tasks table: adding timer_duration_minutes column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN timer_duration_minutes INTEGER DEFAULT NULL').run();
      console.log('✅ Added timer_duration_minutes column to tasks');
    }

    if (!hasLastCompletedDate) {
      console.log('🔄 Migrating tasks table: adding last_completed_date column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN last_completed_date TEXT DEFAULT NULL').run();
      console.log('✅ Added last_completed_date column to tasks');
    }

    // Add scheduled_time for task-specific reminders (e.g., "08:30" or "15:00")
    const hasScheduledTime = tasksInfo.some((col: any) => col.name === 'scheduled_time');
    if (!hasScheduledTime) {
      console.log('🔄 Migrating tasks table: adding scheduled_time column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN scheduled_time TEXT DEFAULT NULL').run();
      console.log('✅ Added scheduled_time column to tasks');
    }

    // Add last_reminder_sent to track when we last sent a reminder for this task
    const hasLastReminderSent = tasksInfo.some((col: any) => col.name === 'last_reminder_sent');
    if (!hasLastReminderSent) {
      console.log('🔄 Migrating tasks table: adding last_reminder_sent column...');
      db.prepare('ALTER TABLE tasks ADD COLUMN last_reminder_sent TEXT DEFAULT NULL').run();
      console.log('✅ Added last_reminder_sent column to tasks');
    }
  } catch (error: any) {
    console.error('Migration error (task timer columns):', error.message);
  }

  // Create timer_states table for tracking active timers
  db.exec(`
    CREATE TABLE IF NOT EXISTS timer_states (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      task_id INTEGER,
      quiz_attempt_id INTEGER,
      timer_type TEXT NOT NULL CHECK(timer_type IN ('task', 'quiz')),
      is_running BOOLEAN NOT NULL DEFAULT 0,
      is_paused BOOLEAN NOT NULL DEFAULT 0,
      elapsed_seconds INTEGER NOT NULL DEFAULT 0,
      start_time DATETIME,
      pause_time DATETIME,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      device_id TEXT,
      sync_version INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for timer_states
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_timer_states_profile_task ON timer_states(profile_id, task_id);
    CREATE INDEX IF NOT EXISTS idx_timer_states_profile_quiz ON timer_states(profile_id, quiz_attempt_id);
    CREATE INDEX IF NOT EXISTS idx_timer_states_running ON timer_states(is_running);
  `);

  // Migration: Add quiz_attempt_id to timer_states if missing
  try {
    const timerInfo: any[] = db.prepare('PRAGMA table_info(timer_states)').all();
    const hasQuizAttemptId = timerInfo.some((col: any) => col.name === 'quiz_attempt_id');

    if (!hasQuizAttemptId) {
      console.log('?? Migrating timer_states: adding quiz_attempt_id column...');
      db.prepare('ALTER TABLE timer_states ADD COLUMN quiz_attempt_id INTEGER').run();
      console.log('? Added quiz_attempt_id column to timer_states');
    }
  } catch (error: any) {
    console.error('Migration error (timer_states quiz_attempt_id):', error.message);
  }

  // ==================== HIDDEN ACHIEVEMENTS ====================
  // Add is_hidden column to achievements table if not exists
  try {
    const achievementColumns = db.prepare("PRAGMA table_info(achievements)").all() as { name: string }[];
    const hasIsHidden = achievementColumns.some(col => col.name === 'is_hidden');

    if (!hasIsHidden) {
      console.log('Adding is_hidden column to achievements table...');
      db.prepare('ALTER TABLE achievements ADD COLUMN is_hidden BOOLEAN DEFAULT 0').run();
      console.log('Added is_hidden column to achievements');
    }
  } catch (error: any) {
    console.error('Migration error (is_hidden):', error.message);
  }

  // Insert hidden achievements
  const hiddenAchievements = [
    { name: 'Early Bird Master', description: 'Complete 5 tasks before 8 AM', icon: '🌅', points_reward: 75, requirement_type: 'early_tasks', requirement_value: 5, is_hidden: 1 },
    { name: 'Night Owl', description: 'Complete a task after 9 PM', icon: '🦉', points_reward: 25, requirement_type: 'late_task', requirement_value: 1, is_hidden: 1 },
    { name: 'Weekend Warrior', description: 'Complete 10 tasks on weekends', icon: '🎮', points_reward: 100, requirement_type: 'weekend_tasks', requirement_value: 10, is_hidden: 1 },
    { name: 'Speed Demon', description: 'Complete 3 tasks in 30 minutes', icon: '⚡', points_reward: 50, requirement_type: 'speed_tasks', requirement_value: 3, is_hidden: 1 },
    { name: 'Perfectionist', description: 'Complete all daily challenges 7 days in a row', icon: '💫', points_reward: 150, requirement_type: 'perfect_week', requirement_value: 7, is_hidden: 1 },
    { name: 'Lucky Spinner', description: 'Win the jackpot on the spin wheel', icon: '🎰', points_reward: 100, requirement_type: 'jackpot_win', requirement_value: 1, is_hidden: 1 },
    { name: 'Countdown Champion', description: 'Complete 5 countdown challenges', icon: '⏱️', points_reward: 100, requirement_type: 'countdown_completed', requirement_value: 5, is_hidden: 1 },
    { name: 'Hydration Hero Plus', description: 'Drink 3L of water in a single day', icon: '💦', points_reward: 50, requirement_type: 'super_hydration', requirement_value: 3000, is_hidden: 1 },
    { name: 'Century Club', description: 'Complete 100 tasks total', icon: '💯', points_reward: 200, requirement_type: 'tasks_completed', requirement_value: 100, is_hidden: 1 },
    { name: 'Point Millionaire', description: 'Earn 1000 total points', icon: '🤑', points_reward: 100, requirement_type: 'total_points', requirement_value: 1000, is_hidden: 1 }
  ];

  const insertHiddenAchievement = db.prepare(`
    INSERT OR IGNORE INTO achievements (name, description, icon, points_reward, requirement_type, requirement_value, is_hidden)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const ach of hiddenAchievements) {
    insertHiddenAchievement.run(ach.name, ach.description, ach.icon, ach.points_reward, ach.requirement_type, ach.requirement_value, ach.is_hidden);
  }

  // =============================================
  // FAMILY QUIZ SYSTEM - Educational quizzes for kids
  // =============================================

  // Quiz Categories with theme configuration
  db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      theme_config TEXT NOT NULL,
      input_config TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Family Quizzes - Parent-created quizzes for their kids
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      category_id INTEGER NOT NULL,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      points_per_correct INTEGER DEFAULT 10,
      stars_per_correct INTEGER DEFAULT 0,
      bonus_points INTEGER DEFAULT 20,
      time_limit_seconds INTEGER,
      pass_threshold INTEGER DEFAULT 70,
      difficulty TEXT DEFAULT 'medium',
      questions TEXT,
      attempts_allowed INTEGER DEFAULT 3,
      passing_score INTEGER DEFAULT 70,
      is_ai_generated INTEGER DEFAULT 0,
      ai_focus_areas TEXT,
      schedule_type TEXT DEFAULT 'anytime',
      schedule_days TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES quiz_categories(id),
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Quiz Questions
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      question_text TEXT NOT NULL,
      question_type TEXT DEFAULT 'multiple_choice',
      question_image TEXT,
      question_audio TEXT,
      options TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      hint TEXT,
      explanation TEXT,
      points INTEGER DEFAULT 10,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (quiz_id) REFERENCES family_quizzes(id) ON DELETE CASCADE
    )
  `);

  // Quiz Attempts - Track each time a kid takes a quiz
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_questions INTEGER NOT NULL,
      correct_answers INTEGER DEFAULT 0,
      wrong_answers INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      score_percentage INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      time_bonus_points INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      passed INTEGER DEFAULT 0,
      FOREIGN KEY (quiz_id) REFERENCES family_quizzes(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Quiz Answers - Detailed answer tracking per question
  db.exec(`
    CREATE TABLE IF NOT EXISTS family_quiz_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      question_id INTEGER NOT NULL,
      selected_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES family_quiz_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (question_id) REFERENCES family_quiz_questions(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for quiz tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_family_quizzes_assigned ON family_quizzes(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_family_quizzes_created ON family_quizzes(created_by);
    CREATE INDEX IF NOT EXISTS idx_family_quiz_questions_quiz ON family_quiz_questions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_family_quiz_attempts_quiz ON family_quiz_attempts(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_family_quiz_attempts_profile ON family_quiz_attempts(profile_id);
  `);

  // Migration: Add competition mode columns to family_quizzes
  try {
    const quizInfo: any[] = db.prepare('PRAGMA table_info(family_quizzes)').all();
    const hasCompetition = quizInfo.some((col: any) => col.name === 'is_competition');

    if (!hasCompetition) {
      console.log('🔄 Migrating family_quizzes: adding competition mode columns...');
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN is_competition INTEGER DEFAULT 0').run();
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN competition_ends_at DATETIME').run();
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN first_place_bonus INTEGER DEFAULT 50').run();
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN second_place_bonus INTEGER DEFAULT 25').run();
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN third_place_bonus INTEGER DEFAULT 10').run();
      console.log('✅ Competition mode columns added to family_quizzes');
    }
  } catch (error: any) {
    console.error('Migration error (quiz competition):', error.message);
  }

  // Migration: Add missing quiz columns used by the API
  try {
    const quizInfo: any[] = db.prepare('PRAGMA table_info(family_quizzes)').all();
    const hasColumn = (name: string) => quizInfo.some((col: any) => col.name === name);

    if (!hasColumn('difficulty')) {
      db.prepare("ALTER TABLE family_quizzes ADD COLUMN difficulty TEXT DEFAULT 'medium'").run();
    }
    if (!hasColumn('questions')) {
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN questions TEXT').run();
    }
    if (!hasColumn('attempts_allowed')) {
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN attempts_allowed INTEGER DEFAULT 3').run();
    }
    if (!hasColumn('passing_score')) {
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN passing_score INTEGER DEFAULT 70').run();
      db.prepare('UPDATE family_quizzes SET passing_score = pass_threshold WHERE passing_score IS NULL').run();
    }
    if (!hasColumn('is_ai_generated')) {
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN is_ai_generated INTEGER DEFAULT 0').run();
    }
    if (!hasColumn('ai_focus_areas')) {
      db.prepare('ALTER TABLE family_quizzes ADD COLUMN ai_focus_areas TEXT').run();
    }
  } catch (error: any) {
    console.error('Migration error (quiz columns):', error.message);
  }

  // Migration: Normalize legacy family_quiz_attempts schema (remove score/answers columns)
  try {
    const attemptInfo: any[] = db.prepare('PRAGMA table_info(family_quiz_attempts)').all();
    const columnNames = attemptInfo.map((col: any) => col.name);
    const hasColumn = (name: string) => columnNames.includes(name);
    const hasLegacyColumns =
      hasColumn('score') ||
      hasColumn('answers') ||
      hasColumn('time_spent_seconds') ||
      hasColumn('total_points') ||
      hasColumn('current_question_index');

    if (hasLegacyColumns) {
      console.log('🔄 Migrating family_quiz_attempts: normalizing schema...');
      db.exec('BEGIN');

      db.exec(`
        CREATE TABLE IF NOT EXISTS family_quiz_attempts_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          quiz_id INTEGER NOT NULL,
          profile_id INTEGER NOT NULL,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          completed_at DATETIME,
          total_questions INTEGER NOT NULL,
          correct_answers INTEGER DEFAULT 0,
          wrong_answers INTEGER DEFAULT 0,
          skipped INTEGER DEFAULT 0,
          score_percentage INTEGER DEFAULT 0,
          points_earned INTEGER DEFAULT 0,
          stars_earned INTEGER DEFAULT 0,
          time_bonus_points INTEGER DEFAULT 0,
          time_taken_seconds INTEGER,
          passed INTEGER DEFAULT 0,
          competition_rank INTEGER,
          bonus_awarded INTEGER DEFAULT 0,
          FOREIGN KEY (quiz_id) REFERENCES family_quizzes(id) ON DELETE CASCADE,
          FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )
      `);

      const startedAtExpr = hasColumn('started_at')
        ? 'COALESCE(started_at, completed_at, CURRENT_TIMESTAMP)'
        : 'COALESCE(completed_at, CURRENT_TIMESTAMP)';
      const completedAtExpr = hasColumn('completed_at') ? 'completed_at' : 'NULL';
      const correctExpr = hasColumn('correct_answers') ? 'COALESCE(correct_answers, 0)' : '0';
      const wrongExpr = hasColumn('wrong_answers') ? 'COALESCE(wrong_answers, 0)' : '0';
      const scoreExpr = hasColumn('score_percentage')
        ? 'COALESCE(score_percentage, 0)'
        : hasColumn('score')
          ? 'COALESCE(score, 0)'
          : '0';
      const pointsExpr = hasColumn('points_earned')
        ? 'COALESCE(points_earned, 0)'
        : hasColumn('total_points')
          ? 'COALESCE(total_points, 0)'
          : '0';
      const starsExpr = hasColumn('stars_earned') ? 'COALESCE(stars_earned, 0)' : '0';
      const timeBonusExpr = hasColumn('time_bonus_points') ? 'COALESCE(time_bonus_points, 0)' : '0';
      const timeExpr = hasColumn('time_taken_seconds')
        ? 'time_taken_seconds'
        : hasColumn('time_spent_seconds')
          ? 'time_spent_seconds'
          : 'NULL';
      const passedExpr = hasColumn('passed') ? 'COALESCE(passed, 0)' : '0';
      const rankExpr = hasColumn('competition_rank') ? 'competition_rank' : 'NULL';
      const bonusExpr = hasColumn('bonus_awarded') ? 'COALESCE(bonus_awarded, 0)' : '0';

      db.exec(`
        INSERT INTO family_quiz_attempts_new (
          id, quiz_id, profile_id, started_at, completed_at, total_questions,
          correct_answers, wrong_answers, skipped, score_percentage,
          points_earned, stars_earned, time_bonus_points, time_taken_seconds, passed,
          competition_rank, bonus_awarded
        )
        SELECT
          id,
          quiz_id,
          profile_id,
          ${startedAtExpr},
          ${completedAtExpr},
          total_questions,
          ${correctExpr},
          ${wrongExpr},
          0,
          ${scoreExpr},
          ${pointsExpr},
          ${starsExpr},
          ${timeBonusExpr},
          ${timeExpr},
          ${passedExpr},
          ${rankExpr},
          ${bonusExpr}
        FROM family_quiz_attempts
      `);

      db.exec('DROP TABLE family_quiz_attempts');
      db.exec('ALTER TABLE family_quiz_attempts_new RENAME TO family_quiz_attempts');
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_family_quiz_attempts_quiz ON family_quiz_attempts(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_family_quiz_attempts_profile ON family_quiz_attempts(profile_id);
      `);
      db.exec('COMMIT');
      console.log('✅ family_quiz_attempts migration complete');
    }
  } catch (error: any) {
    console.error('Migration error (attempts normalize):', error.message);
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
  }

  // Migration: Add competition rank to quiz attempts
  try {
    const attemptInfo: any[] = db.prepare('PRAGMA table_info(family_quiz_attempts)').all();
    const hasRank = attemptInfo.some((col: any) => col.name === 'competition_rank');

    if (!hasRank) {
      console.log('🔄 Migrating family_quiz_attempts: adding competition tracking...');
      db.prepare('ALTER TABLE family_quiz_attempts ADD COLUMN competition_rank INTEGER').run();
      db.prepare('ALTER TABLE family_quiz_attempts ADD COLUMN bonus_awarded INTEGER DEFAULT 0').run();
      console.log('✅ Competition tracking columns added to family_quiz_attempts');
    }
  } catch (error: any) {
    console.error('Migration error (attempt competition):', error.message);
  }

  // Migration: Add time bonus points to quiz attempts
  try {
    const attemptInfo: any[] = db.prepare('PRAGMA table_info(family_quiz_attempts)').all();
    const hasTimeBonus = attemptInfo.some((col: any) => col.name === 'time_bonus_points');

    if (!hasTimeBonus) {
      console.log('?? Migrating family_quiz_attempts: adding time_bonus_points...');
      db.prepare('ALTER TABLE family_quiz_attempts ADD COLUMN time_bonus_points INTEGER DEFAULT 0').run();
      console.log('? Added time_bonus_points to family_quiz_attempts');
    }
  } catch (error: any) {
    console.error('Migration error (attempt time bonus):', error.message);
  }

  // Insert default quiz categories with theme configurations
  const quizCategories = [
    {
      name: 'alphabet',
      display_name: 'Alphabet',
      icon: '🔤',
      description: 'Learn letters and spelling',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#3B82F6', secondary: '#1E40AF', accent: '#F59E0B', background: 'from-blue-600 to-indigo-700' },
          mascot: '🦸‍♂️',
          animations: ['letter_zoom', 'superhero_punch', 'comic_burst'],
          sounds: { correct: 'hero_power', wrong: 'try_again', complete: 'victory' },
          encouragements: ['Super spelling!', 'Hero letters!', 'Amazing!', 'POW!']
        },
        girl: {
          colors: { primary: '#EC4899', secondary: '#9333EA', accent: '#F59E0B', background: 'from-pink-500 to-purple-600' },
          mascot: '🧚',
          animations: ['sparkle_letters', 'magic_wand', 'fairy_dust'],
          sounds: { correct: 'magic_chime', wrong: 'gentle_oops', complete: 'celebration' },
          encouragements: ['Magical!', 'Fairy-tale spelling!', 'Sparkle power!', 'Wonderful!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'What letter is this?',
        supports_images: true,
        supports_audio: true,
        default_options_count: 4,
        option_style: 'letters'
      })
    },
    {
      name: 'math',
      display_name: 'Math',
      icon: '🔢',
      description: 'Numbers and calculations',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#10B981', secondary: '#047857', accent: '#FBBF24', background: 'from-emerald-600 to-teal-700' },
          mascot: '🤖',
          animations: ['calculator_spin', 'number_explosion', 'rocket_math'],
          sounds: { correct: 'robot_beep', wrong: 'error_buzz', complete: 'level_up' },
          encouragements: ['Math wizard!', 'Number ninja!', 'Computing genius!', 'BOOM!']
        },
        girl: {
          colors: { primary: '#8B5CF6', secondary: '#6D28D9', accent: '#FCD34D', background: 'from-violet-500 to-purple-600' },
          mascot: '🦋',
          animations: ['star_burst', 'rainbow_numbers', 'butterfly_flutter'],
          sounds: { correct: 'sparkle', wrong: 'soft_miss', complete: 'fanfare' },
          encouragements: ['Brilliant!', 'Math star!', 'You sparkle!', 'Perfect!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'What is the answer?',
        supports_equations: true,
        equation_builder: true,
        operators: ['+', '-', '×', '÷'],
        option_style: 'numbers'
      })
    },
    {
      name: 'geography',
      display_name: 'Geography',
      icon: '🌍',
      description: 'Countries, capitals, and maps',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#F59E0B', secondary: '#D97706', accent: '#3B82F6', background: 'from-amber-500 to-orange-600' },
          mascot: '🧭',
          animations: ['globe_spin', 'explorer_walk', 'map_zoom'],
          sounds: { correct: 'discovery', wrong: 'compass_spin', complete: 'adventure_win' },
          encouragements: ['Explorer!', 'World traveler!', 'Navigator pro!', 'Discovery!']
        },
        girl: {
          colors: { primary: '#06B6D4', secondary: '#0891B2', accent: '#F472B6', background: 'from-cyan-500 to-teal-600' },
          mascot: '🦜',
          animations: ['world_sparkle', 'travel_magic', 'flag_wave'],
          sounds: { correct: 'bird_song', wrong: 'gentle_wave', complete: 'celebration' },
          encouragements: ['World princess!', 'Amazing explorer!', 'Travel star!', 'Beautiful!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'Which country/capital is this?',
        supports_images: true,
        supports_maps: true,
        option_style: 'text'
      })
    },
    {
      name: 'history',
      display_name: 'History',
      icon: '📜',
      description: 'Historical events and people',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#78350F', secondary: '#92400E', accent: '#FCD34D', background: 'from-amber-800 to-yellow-700' },
          mascot: '⚔️',
          animations: ['scroll_unfurl', 'knight_charge', 'castle_build'],
          sounds: { correct: 'sword_swing', wrong: 'shield_block', complete: 'victory_horn' },
          encouragements: ['Knight scholar!', 'History hero!', 'Time warrior!', 'Legendary!']
        },
        girl: {
          colors: { primary: '#BE185D', secondary: '#9D174D', accent: '#FDE68A', background: 'from-rose-600 to-pink-700' },
          mascot: '👑',
          animations: ['crown_sparkle', 'royal_scroll', 'time_travel'],
          sounds: { correct: 'harp_strum', wrong: 'soft_bell', complete: 'royal_fanfare' },
          encouragements: ['Royal scholar!', 'History princess!', 'Time queen!', 'Majestic!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'What happened / Who is this?',
        supports_images: true,
        supports_dates: true,
        option_style: 'text'
      })
    },
    {
      name: 'science',
      display_name: 'Science',
      icon: '🔬',
      description: 'Scientific facts and nature',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#059669', secondary: '#047857', accent: '#60A5FA', background: 'from-emerald-600 to-green-700' },
          mascot: '🧪',
          animations: ['beaker_bubble', 'atom_spin', 'rocket_launch'],
          sounds: { correct: 'science_pop', wrong: 'bubble_fail', complete: 'blast_off' },
          encouragements: ['Scientist!', 'Lab genius!', 'Discovery master!', 'Eureka!']
        },
        girl: {
          colors: { primary: '#7C3AED', secondary: '#6D28D9', accent: '#A5F3FC', background: 'from-violet-600 to-indigo-700' },
          mascot: '🔮',
          animations: ['crystal_glow', 'nature_bloom', 'star_discovery'],
          sounds: { correct: 'crystal_chime', wrong: 'soft_poof', complete: 'magic_complete' },
          encouragements: ['Science star!', 'Nature princess!', 'Discovery queen!', 'Magical!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'What is the answer?',
        supports_images: true,
        option_style: 'text'
      })
    },
    {
      name: 'language',
      display_name: 'Language',
      icon: '📖',
      description: 'Words, sentences, and reading',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#2563EB', secondary: '#1D4ED8', accent: '#FCD34D', background: 'from-blue-600 to-blue-800' },
          mascot: '📚',
          animations: ['book_flip', 'word_power', 'story_unfold'],
          sounds: { correct: 'page_turn', wrong: 'eraser', complete: 'book_close' },
          encouragements: ['Word hero!', 'Story master!', 'Reading champ!', 'Awesome!']
        },
        girl: {
          colors: { primary: '#DB2777', secondary: '#BE185D', accent: '#FDE68A', background: 'from-pink-600 to-rose-700' },
          mascot: '🦄',
          animations: ['story_sparkle', 'word_dance', 'rainbow_read'],
          sounds: { correct: 'fairy_word', wrong: 'soft_miss', complete: 'story_end' },
          encouragements: ['Word fairy!', 'Story princess!', 'Reading star!', 'Beautiful!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'Complete the sentence / What word is this?',
        supports_images: true,
        supports_audio: true,
        option_style: 'text'
      })
    },
    {
      name: 'colors_shapes',
      display_name: 'Colors & Shapes',
      icon: '🎨',
      description: 'Colors and shapes for young kids',
      theme_config: JSON.stringify({
        boy: {
          colors: { primary: '#EF4444', secondary: '#DC2626', accent: '#34D399', background: 'from-red-500 to-orange-500' },
          mascot: '🎯',
          animations: ['color_splash', 'shape_bounce', 'paint_splat'],
          sounds: { correct: 'pop', wrong: 'boing', complete: 'tada' },
          encouragements: ['Color hero!', 'Shape master!', 'Artist!', 'Wow!']
        },
        girl: {
          colors: { primary: '#F472B6', secondary: '#EC4899', accent: '#A78BFA', background: 'from-pink-400 to-purple-500' },
          mascot: '🌈',
          animations: ['rainbow_burst', 'sparkle_shape', 'glitter_paint'],
          sounds: { correct: 'twinkle', wrong: 'soft_miss', complete: 'magic_complete' },
          encouragements: ['Rainbow star!', 'Shape fairy!', 'Color princess!', 'Pretty!']
        }
      }),
      input_config: JSON.stringify({
        question_placeholder: 'What color/shape is this?',
        supports_images: true,
        color_picker: true,
        shape_picker: true,
        option_style: 'visual'
      })
    }
  ];

  const insertQuizCategory = db.prepare(`
    INSERT OR IGNORE INTO quiz_categories (name, display_name, icon, description, theme_config, input_config)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const cat of quizCategories) {
    insertQuizCategory.run(cat.name, cat.display_name, cat.icon, cat.description, cat.theme_config, cat.input_config);
  }

  console.log('✅ Quiz system tables created');

  // =============================================
  // AI BOOK SYSTEM - AI-generated children's books
  // =============================================

  // Books table - stores AI-generated books
  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      cover_image TEXT,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER,
      age_range TEXT DEFAULT '4-8',
      language TEXT DEFAULT 'en',
      genre TEXT DEFAULT 'story',
      theme TEXT,
      total_pages INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      is_ai_generated INTEGER DEFAULT 1,
      ai_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Book pages - individual pages of each book
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      page_number INTEGER NOT NULL,
      title TEXT,
      content TEXT NOT NULL,
      image_prompt TEXT,
      image_url TEXT,
      audio_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      UNIQUE(book_id, page_number)
    )
  `);

  // Book reading progress - tracks reading progress per profile
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      current_page INTEGER DEFAULT 1,
      pages_read INTEGER DEFAULT 0,
      completed INTEGER DEFAULT 0,
      completed_at DATETIME,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(book_id, profile_id)
    )
  `);

  // Book categories for organizing books
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Book-category relationship (many-to-many)
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_category_mapping (
      book_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      PRIMARY KEY (book_id, category_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES book_categories(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for book tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_books_created_by ON books(created_by);
    CREATE INDEX IF NOT EXISTS idx_books_assigned_to ON books(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_book_pages_book ON book_pages(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_reading_progress_book ON book_reading_progress(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_reading_progress_profile ON book_reading_progress(profile_id);
  `);

  // Book feedback/ratings from kids
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      liked INTEGER DEFAULT 0,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(book_id, profile_id)
    )
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_book_feedback_book ON book_feedback(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_feedback_profile ON book_feedback(profile_id);
  `);
  console.log('✅ Book feedback table created');

  // Insert default book categories
  const bookCategories = [
    { name: 'adventure', display_name: 'Adventure', icon: '🗺️', description: 'Exciting adventures and exploration stories' },
    { name: 'animals', display_name: 'Animals', icon: '🐾', description: 'Stories about animals and nature' },
    { name: 'fantasy', display_name: 'Fantasy', icon: '🧙', description: 'Magical worlds and fantastical creatures' },
    { name: 'educational', display_name: 'Educational', icon: '📚', description: 'Learning through stories' },
    { name: 'bedtime', display_name: 'Bedtime', icon: '🌙', description: 'Calm stories for bedtime' },
    { name: 'friendship', display_name: 'Friendship', icon: '🤝', description: 'Stories about making and keeping friends' },
    { name: 'family', display_name: 'Family', icon: '👨‍👩‍👧‍👦', description: 'Stories about family relationships' },
    { name: 'science', display_name: 'Science', icon: '🔬', description: 'Science and discovery stories' },
    { name: 'history', display_name: 'History', icon: '📜', description: 'Historical stories and legends' },
    { name: 'tigrinya', display_name: 'Tigrinya', icon: '🇪🇷', description: 'Stories in Tigrinya language' }
  ];

  const insertBookCategory = db.prepare(`
    INSERT OR IGNORE INTO book_categories (name, display_name, icon, description)
    VALUES (?, ?, ?, ?)
  `);

  for (const cat of bookCategories) {
    insertBookCategory.run(cat.name, cat.display_name, cat.icon, cat.description);
  }

  console.log('✅ Book system tables created');

  // ==================== BOOK READING NOTES ====================
  // Notes for tracking what kids learned from books
  db.exec(`
    CREATE TABLE IF NOT EXISTS book_reading_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      note_type TEXT DEFAULT 'learning' CHECK(note_type IN ('learning', 'favorite_part', 'question', 'vocabulary', 'struggle', 'other')),
      content TEXT NOT NULL,
      page_reference INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_book_reading_notes_book ON book_reading_notes(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_reading_notes_profile ON book_reading_notes(profile_id);
  `);

  console.log('✅ Book reading notes table created');

  // Migration: Add physical book support columns to books table
  try {
    const bookCols = db.prepare('PRAGMA table_info(books)').all() as { name: string }[];
    const colNames = bookCols.map(col => col.name);

    if (!colNames.includes('author')) {
      db.prepare('ALTER TABLE books ADD COLUMN author TEXT').run();
      console.log('✅ Added author column to books');
    }

    if (!colNames.includes('book_source')) {
      db.prepare("ALTER TABLE books ADD COLUMN book_source TEXT DEFAULT 'ai' CHECK(book_source IN ('ai', 'physical'))").run();
      console.log('✅ Added book_source column to books');
    }

    if (!colNames.includes('source_location')) {
      db.prepare('ALTER TABLE books ADD COLUMN source_location TEXT').run();
      console.log('✅ Added source_location column to books');
    }

    if (!colNames.includes('isbn')) {
      db.prepare('ALTER TABLE books ADD COLUMN isbn TEXT').run();
      console.log('✅ Added isbn column to books');
    }
  } catch (error: any) {
    console.error('Migration error (books physical columns):', error.message);
  }

  // Migration: Add reading_status to book_reading_progress
  try {
    const progressCols = db.prepare('PRAGMA table_info(book_reading_progress)').all() as { name: string }[];
    const hasReadingStatus = progressCols.some(col => col.name === 'reading_status');

    if (!hasReadingStatus) {
      db.prepare("ALTER TABLE book_reading_progress ADD COLUMN reading_status TEXT DEFAULT 'reading' CHECK(reading_status IN ('reading', 'finished', 'struggling', 'paused'))").run();
      console.log('✅ Added reading_status column to book_reading_progress');
    }
  } catch (error: any) {
    console.error('Migration error (book_reading_progress status):', error.message);
  }

  // ==================== CUSTOM REWARD CATEGORIES ====================
  // Allow parents to create custom reward categories
  db.exec(`
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
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL,
      UNIQUE(name, created_by)
    )
  `);

  // Insert default reward categories
  const defaultRewardCategories = [
    { name: 'general', display_name: 'General', icon: '🎁', description: 'General rewards', color: '#6366f1' },
    { name: 'screen_time', display_name: 'Screen Time', icon: '📱', description: 'Extra screen time rewards', color: '#3b82f6' },
    { name: 'treats', display_name: 'Treats & Food', icon: '🍦', description: 'Food and treat rewards', color: '#f97316' },
    { name: 'toys', display_name: 'Toys & Games', icon: '🧸', description: 'Toy and game rewards', color: '#ec4899' },
    { name: 'activities', display_name: 'Activities', icon: '🎪', description: 'Fun activity rewards', color: '#14b8a6' },
    { name: 'money', display_name: 'Pocket Money', icon: '💰', description: 'Cash rewards', color: '#22c55e' },
    { name: 'family_outing', display_name: 'Family Outing', icon: '🎢', description: 'Family trip rewards', color: '#a855f7' }
  ];

  const insertRewardCategory = db.prepare(`
    INSERT OR IGNORE INTO reward_categories (name, display_name, icon, description, color, is_default)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const cat of defaultRewardCategories) {
    insertRewardCategory.run(cat.name, cat.display_name, cat.icon, cat.description, cat.color);
  }

  console.log('✅ Reward categories created');

  // ==================== AI USAGE TRACKING & LIMITS ====================
  // Track AI generation usage per family for cost control
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_usage_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      parent_id INTEGER,
      feature_type TEXT NOT NULL CHECK(feature_type IN ('book', 'quiz', 'task', 'chat', 'activity')),
      provider TEXT NOT NULL,
      estimated_cost REAL DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      images_generated INTEGER DEFAULT 0,
      success BOOLEAN DEFAULT 1,
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Family-level AI generation limits
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_generation_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL UNIQUE,
      daily_book_limit INTEGER DEFAULT 5,
      daily_quiz_limit INTEGER DEFAULT 10,
      daily_task_limit INTEGER DEFAULT 20,
      monthly_cost_limit REAL DEFAULT 10.00,
      require_approval BOOLEAN DEFAULT 0,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Migration: Add daily_activity_limit to ai_generation_limits
  try {
    const columns = db.prepare('PRAGMA table_info(ai_generation_limits)').all() as any[];
    const hasActivityLimit = columns.some((col: any) => col.name === 'daily_activity_limit');

    if (!hasActivityLimit) {
      console.log('🔄 Migrating ai_generation_limits: adding daily_activity_limit...');
      db.prepare('ALTER TABLE ai_generation_limits ADD COLUMN daily_activity_limit INTEGER DEFAULT 10').run();
      console.log('✅ Added daily_activity_limit column to ai_generation_limits');
    }
  } catch (error: any) {
    if (!error.message.includes('duplicate column')) {
      console.error('Migration error (ai_generation_limits daily_activity_limit):', error.message);
    }
  }

  // Create indexes for AI usage
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ai_usage_profile ON ai_usage_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_parent ON ai_usage_logs(parent_id);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ai_usage_logs(feature_type);
  `);

  console.log('✅ AI usage tracking tables created');

  // ==================== GOAL TEMPLATES ====================
  // Pre-defined goal templates with cost estimates for family activities
  db.exec(`
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
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Insert default goal templates with cost estimates
  const defaultGoalTemplates = [
    // Family Outings
    { name: 'Movie Night', description: 'Go to the movies as a family', category: 'family_outing', icon: '🎬', points: 500, costMin: 40, costMax: 80, multiplier: 1.2 },
    { name: 'Restaurant Dinner', description: 'Family dinner at a restaurant', category: 'family_outing', icon: '🍽️', points: 600, costMin: 60, costMax: 150, multiplier: 1.3 },
    { name: 'Theme Park Day', description: 'Spend a day at a theme park', category: 'family_outing', icon: '🎢', points: 1500, costMin: 150, costMax: 400, multiplier: 1.5 },
    { name: 'Zoo or Aquarium', description: 'Visit a zoo or aquarium', category: 'family_outing', icon: '🦁', points: 800, costMin: 50, costMax: 120, multiplier: 1.3 },
    { name: 'Bowling Night', description: 'Go bowling as a family', category: 'family_outing', icon: '🎳', points: 400, costMin: 30, costMax: 70, multiplier: 1.2 },
    { name: 'Mini Golf', description: 'Play mini golf together', category: 'family_outing', icon: '⛳', points: 300, costMin: 25, costMax: 50, multiplier: 1.2 },
    { name: 'Beach Day', description: 'Spend a day at the beach', category: 'family_outing', icon: '🏖️', points: 200, costMin: 20, costMax: 50, multiplier: 1.1 },
    { name: 'Hiking Adventure', description: 'Go on a family hike', category: 'family_outing', icon: '🥾', points: 150, costMin: 0, costMax: 30, multiplier: 1.0 },

    // Treats & Food
    { name: 'Ice Cream Trip', description: 'Get ice cream at a shop', category: 'treats', icon: '🍦', points: 100, costMin: 10, costMax: 25, multiplier: 1.2 },
    { name: 'Pizza Party', description: 'Order pizza for dinner', category: 'treats', icon: '🍕', points: 150, costMin: 20, costMax: 40, multiplier: 1.3 },
    { name: 'Bakery Visit', description: 'Pick treats from a bakery', category: 'treats', icon: '🧁', points: 80, costMin: 8, costMax: 20, multiplier: 1.2 },

    // Toys & Games
    { name: 'New Video Game', description: 'Get a new video game', category: 'toys', icon: '🎮', points: 800, costMin: 30, costMax: 70, multiplier: 1.0 },
    { name: 'Small Toy', description: 'Pick a small toy or figure', category: 'toys', icon: '🧸', points: 300, costMin: 10, costMax: 30, multiplier: 1.0 },
    { name: 'LEGO Set', description: 'Get a LEGO set', category: 'toys', icon: '🧱', points: 600, costMin: 25, costMax: 100, multiplier: 1.0 },
    { name: 'Board Game', description: 'Get a new board game', category: 'toys', icon: '🎲', points: 400, costMin: 20, costMax: 50, multiplier: 1.0 },

    // Screen Time
    { name: 'Extra Screen Time (30 min)', description: '30 minutes extra screen time', category: 'screen_time', icon: '📱', points: 100, costMin: 0, costMax: 0, multiplier: 1.0 },
    { name: 'Extra Screen Time (1 hour)', description: '1 hour extra screen time', category: 'screen_time', icon: '📺', points: 200, costMin: 0, costMax: 0, multiplier: 1.0 },
    { name: 'Movie Rental', description: 'Rent a movie to watch at home', category: 'screen_time', icon: '🎞️', points: 150, costMin: 5, costMax: 10, multiplier: 1.0 },

    // Pocket Money
    { name: 'Small Allowance ($5)', description: '$5 pocket money', category: 'money', icon: '💵', points: 500, costMin: 5, costMax: 5, multiplier: 1.0 },
    { name: 'Medium Allowance ($10)', description: '$10 pocket money', category: 'money', icon: '💰', points: 1000, costMin: 10, costMax: 10, multiplier: 1.0 },
    { name: 'Big Allowance ($20)', description: '$20 pocket money', category: 'money', icon: '🤑', points: 2000, costMin: 20, costMax: 20, multiplier: 1.0 },

    // Special Activities
    { name: 'Sleepover', description: 'Have a friend sleep over', category: 'activities', icon: '🛏️', points: 400, costMin: 20, costMax: 50, multiplier: 1.0 },
    { name: 'Birthday Party', description: 'Have a birthday party with friends', category: 'activities', icon: '🎂', points: 2000, costMin: 100, costMax: 300, multiplier: 1.5 },
    { name: 'Sports Event', description: 'Go to a sports game', category: 'activities', icon: '⚽', points: 1000, costMin: 50, costMax: 200, multiplier: 1.3 }
  ];

  const insertGoalTemplate = db.prepare(`
    INSERT OR IGNORE INTO goal_templates (
      name, description, category, icon, suggested_points,
      estimated_cost_min, estimated_cost_max, family_size_multiplier, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const t of defaultGoalTemplates) {
    insertGoalTemplate.run(
      t.name, t.description, t.category, t.icon, t.points,
      t.costMin, t.costMax, t.multiplier
    );
  }

  console.log('✅ Goal templates created');

  // ==================== SHOPPING GAMIFICATION ====================
  // Shopping lists created by parents
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      store_name TEXT,
      budget REAL,
      points_per_item INTEGER DEFAULT 5,
      bonus_for_completion INTEGER DEFAULT 20,
      bonus_for_good_behavior INTEGER DEFAULT 15,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Items in shopping lists
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      quantity INTEGER DEFAULT 1,
      unit TEXT,
      estimated_price REAL,
      notes TEXT,
      is_optional BOOLEAN DEFAULT 0,
      points_value INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE
    )
  `);

  // Shopping trips (instances of going shopping)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL,
      parent_id INTEGER NOT NULL,
      store_name TEXT,
      status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'in_progress', 'completed', 'cancelled')),
      scheduled_at DATETIME,
      started_at DATETIME,
      completed_at DATETIME,
      total_spent REAL,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (list_id) REFERENCES shopping_lists(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Kids assigned to help with shopping trips
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_helpers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      status TEXT DEFAULT 'assigned' CHECK(status IN ('assigned', 'participated', 'completed')),
      behavior_rating INTEGER CHECK(behavior_rating >= 1 AND behavior_rating <= 5),
      items_found INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      bonus_earned INTEGER DEFAULT 0,
      parent_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (trip_id) REFERENCES shopping_trips(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      UNIQUE(trip_id, profile_id)
    )
  `);

  // Individual item completion during shopping
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_item_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      found_by INTEGER,
      actual_price REAL,
      quantity_bought INTEGER,
      was_substituted BOOLEAN DEFAULT 0,
      substitution_notes TEXT,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES shopping_trips(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES shopping_items(id) ON DELETE CASCADE,
      FOREIGN KEY (found_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Create indexes for shopping tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_shopping_lists_parent ON shopping_lists(parent_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON shopping_items(list_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_trips_list ON shopping_trips(list_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_trips_status ON shopping_trips(status);
    CREATE INDEX IF NOT EXISTS idx_shopping_helpers_trip ON shopping_helpers(trip_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_helpers_profile ON shopping_helpers(profile_id);
    CREATE INDEX IF NOT EXISTS idx_shopping_completions_trip ON shopping_item_completions(trip_id);
  `);

  // Default item categories for shopping
  db.exec(`
    CREATE TABLE IF NOT EXISTS shopping_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      icon TEXT DEFAULT '🛒',
      color TEXT DEFAULT '#6366f1',
      sort_order INTEGER DEFAULT 0,
      is_default BOOLEAN DEFAULT 0
    )
  `);

  // Insert default shopping categories
  const defaultShoppingCategories = [
    { name: 'produce', display_name: 'Fruits & Vegetables', icon: '🥬', color: '#22c55e', order: 1 },
    { name: 'dairy', display_name: 'Dairy & Eggs', icon: '🥛', color: '#3b82f6', order: 2 },
    { name: 'meat', display_name: 'Meat & Seafood', icon: '🥩', color: '#ef4444', order: 3 },
    { name: 'bakery', display_name: 'Bakery & Bread', icon: '🍞', color: '#f59e0b', order: 4 },
    { name: 'frozen', display_name: 'Frozen Foods', icon: '🧊', color: '#06b6d4', order: 5 },
    { name: 'snacks', display_name: 'Snacks & Candy', icon: '🍿', color: '#8b5cf6', order: 6 },
    { name: 'beverages', display_name: 'Drinks & Beverages', icon: '🥤', color: '#ec4899', order: 7 },
    { name: 'pantry', display_name: 'Pantry & Canned', icon: '🥫', color: '#f97316', order: 8 },
    { name: 'household', display_name: 'Household Items', icon: '🧹', color: '#64748b', order: 9 },
    { name: 'personal', display_name: 'Personal Care', icon: '🧴', color: '#14b8a6', order: 10 },
    { name: 'other', display_name: 'Other', icon: '📦', color: '#6b7280', order: 99 }
  ];

  const insertShoppingCategory = db.prepare(`
    INSERT OR IGNORE INTO shopping_categories (name, display_name, icon, color, sort_order, is_default)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  for (const cat of defaultShoppingCategories) {
    insertShoppingCategory.run(cat.name, cat.display_name, cat.icon, cat.color, cat.order);
  }

  console.log('✅ Shopping gamification tables created');

  // ==================== LEARNING ACTIVITY ENGINE ====================
  // Activity type definitions (seeded data)
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      description TEXT,
      icon TEXT NOT NULL,
      difficulty_base INTEGER DEFAULT 1,
      supports_images INTEGER DEFAULT 1,
      supports_audio INTEGER DEFAULT 0,
      min_items INTEGER DEFAULT 2,
      max_items INTEGER DEFAULT 20,
      config_schema TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Learning sessions (replaces family_quizzes for multi-activity learning)
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      topic TEXT NOT NULL,
      age_range TEXT,
      created_by INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      points_per_activity INTEGER DEFAULT 20,
      stars_per_session INTEGER DEFAULT 1,
      bonus_points INTEGER DEFAULT 50,
      time_limit_seconds INTEGER,
      pass_threshold INTEGER DEFAULT 70,
      is_ai_generated INTEGER DEFAULT 0,
      ai_prompt TEXT,
      ai_provider TEXT,
      schedule_type TEXT DEFAULT 'anytime',
      schedule_days TEXT,
      is_active INTEGER DEFAULT 1,
      is_competition INTEGER DEFAULT 0,
      competition_ends_at DATETIME,
      first_place_bonus INTEGER DEFAULT 50,
      second_place_bonus INTEGER DEFAULT 25,
      third_place_bonus INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Individual activities within a session
  db.exec(`
    CREATE TABLE IF NOT EXISTS learning_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      activity_type_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      instructions TEXT,
      content_data TEXT NOT NULL,
      correct_data TEXT NOT NULL,
      hints TEXT,
      explanation TEXT,
      points INTEGER DEFAULT 20,
      time_limit_seconds INTEGER,
      order_index INTEGER DEFAULT 0,
      difficulty TEXT DEFAULT 'medium',
      image_url TEXT,
      audio_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_type_id) REFERENCES activity_types(id)
    )
  `);

  // Session attempt tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_activities INTEGER NOT NULL,
      completed_activities INTEGER DEFAULT 0,
      total_score INTEGER DEFAULT 0,
      max_possible_score INTEGER NOT NULL,
      score_percentage INTEGER DEFAULT 0,
      points_earned INTEGER DEFAULT 0,
      stars_earned INTEGER DEFAULT 0,
      time_bonus_points INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      passed INTEGER DEFAULT 0,
      competition_rank INTEGER,
      bonus_awarded INTEGER DEFAULT 0,
      FOREIGN KEY (session_id) REFERENCES learning_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // Individual activity results
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      activity_id INTEGER NOT NULL,
      user_response TEXT NOT NULL,
      score INTEGER DEFAULT 0,
      max_score INTEGER NOT NULL,
      is_correct INTEGER DEFAULT 0,
      partial_score REAL DEFAULT 0,
      hints_used INTEGER DEFAULT 0,
      time_taken_seconds INTEGER,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES session_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (activity_id) REFERENCES learning_activities(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for learning activity tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_learning_sessions_assigned ON learning_sessions(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_learning_sessions_created ON learning_sessions(created_by);
    CREATE INDEX IF NOT EXISTS idx_learning_activities_session ON learning_activities(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_attempts_session ON session_attempts(session_id);
    CREATE INDEX IF NOT EXISTS idx_session_attempts_profile ON session_attempts(profile_id);
    CREATE INDEX IF NOT EXISTS idx_activity_results_attempt ON activity_results(attempt_id);
  `);

  // Seed default activity types
  const defaultActivityTypes = [
    { name: 'multiple_choice', display_name: 'Multiple Choice', icon: 'CheckSquare', description: 'Pick the correct answer from options', difficulty_base: 1, supports_images: 1, supports_audio: 1 },
    { name: 'fill_blanks', display_name: 'Fill in the Blanks', icon: 'Edit3', description: 'Type the missing words in sentences', difficulty_base: 2, supports_images: 1, supports_audio: 0 },
    { name: 'drag_drop', display_name: 'Drag & Drop', icon: 'Move', description: 'Drag items to their correct zones', difficulty_base: 2, supports_images: 1, supports_audio: 0 },
    { name: 'memory_game', display_name: 'Memory Game', icon: 'Grid', description: 'Flip cards to find matching pairs', difficulty_base: 2, supports_images: 1, supports_audio: 0 },
    { name: 'flashcards', display_name: 'Flashcards', icon: 'Layers', description: 'Flip cards to learn and memorize', difficulty_base: 1, supports_images: 1, supports_audio: 1 },
    { name: 'sorting', display_name: 'Sorting', icon: 'ArrowUpDown', description: 'Put items in the correct order', difficulty_base: 2, supports_images: 1, supports_audio: 0 },
    { name: 'matching', display_name: 'Matching', icon: 'Link', description: 'Draw lines to connect related items', difficulty_base: 2, supports_images: 1, supports_audio: 0 },
    { name: 'true_false', display_name: 'True or False', icon: 'ToggleLeft', description: 'Decide if statements are true or false', difficulty_base: 1, supports_images: 1, supports_audio: 0 },
    { name: 'arithmetic', display_name: 'Math Quiz', icon: 'Calculator', description: 'Solve math problems', difficulty_base: 2, supports_images: 0, supports_audio: 0 },
    { name: 'word_search', display_name: 'Word Search', icon: 'Search', description: 'Find hidden words in a grid', difficulty_base: 3, supports_images: 0, supports_audio: 0 },
    { name: 'crossword', display_name: 'Crossword', icon: 'Hash', description: 'Fill in the crossword puzzle', difficulty_base: 3, supports_images: 0, supports_audio: 0 },
    { name: 'image_hotspots', display_name: 'Image Explorer', icon: 'Target', description: 'Click parts of an image to learn', difficulty_base: 2, supports_images: 1, supports_audio: 1 }
  ];

  const insertActivityType = db.prepare(`
    INSERT OR IGNORE INTO activity_types (name, display_name, icon, description, difficulty_base, supports_images, supports_audio)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  for (const at of defaultActivityTypes) {
    insertActivityType.run(at.name, at.display_name, at.icon, at.description, at.difficulty_base, at.supports_images, at.supports_audio);
  }

  console.log('✅ Learning Activity Engine tables created');

  // Migration: Add category_id to shopping_items if it doesn't exist
  try {
    const columns = db.prepare('PRAGMA table_info(shopping_items)').all() as any[];
    const hasCategoryId = columns.some((col: any) => col.name === 'category_id');

    if (!hasCategoryId) {
      console.log('🔄 Migrating shopping_items table: adding category_id...');
      db.prepare('ALTER TABLE shopping_items ADD COLUMN category_id INTEGER REFERENCES shopping_categories(id)').run();
      console.log('✅ Added category_id column to shopping_items');
    }
  } catch (error: any) {
    // Column might already exist or table doesn't exist yet
    if (!error.message.includes('duplicate column')) {
      console.error('Migration error (shopping_items category_id):', error.message);
    }
  }

  // ==================== H5P Content Tables ====================

  // H5P Content - Stores metadata about H5P content packages
  db.exec(`
    CREATE TABLE IF NOT EXISTS h5p_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      h5p_content_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT NOT NULL,
      library_name TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      metadata TEXT DEFAULT '{}',
      is_ai_generated BOOLEAN DEFAULT 0,
      ai_prompt TEXT,
      ai_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // H5P Assignments - Links H5P content to children
  db.exec(`
    CREATE TABLE IF NOT EXISTS h5p_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      h5p_content_id INTEGER NOT NULL,
      assigned_to INTEGER NOT NULL,
      assigned_by INTEGER NOT NULL,
      points INTEGER DEFAULT 10,
      due_date DATETIME,
      is_required BOOLEAN DEFAULT 0,
      max_attempts INTEGER DEFAULT 0,
      pass_percentage INTEGER DEFAULT 70,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (h5p_content_id) REFERENCES h5p_content(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_to) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);

  // H5P Attempts - Tracks each attempt at completing H5P content
  db.exec(`
    CREATE TABLE IF NOT EXISTS h5p_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      h5p_content_id INTEGER NOT NULL,
      score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 100,
      score_percentage REAL DEFAULT 0,
      passed BOOLEAN DEFAULT 0,
      time_spent_seconds INTEGER DEFAULT 0,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      xapi_data TEXT,
      FOREIGN KEY (assignment_id) REFERENCES h5p_assignments(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (h5p_content_id) REFERENCES h5p_content(id) ON DELETE CASCADE
    )
  `);

  // H5P xAPI Logs - Stores granular xAPI events for analytics
  db.exec(`
    CREATE TABLE IF NOT EXISTS h5p_xapi_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attempt_id INTEGER NOT NULL,
      profile_id INTEGER NOT NULL,
      h5p_content_id INTEGER NOT NULL,
      verb TEXT NOT NULL,
      object_id TEXT,
      object_type TEXT,
      result_score REAL,
      result_max_score REAL,
      result_success BOOLEAN,
      result_completion BOOLEAN,
      result_duration TEXT,
      context_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (attempt_id) REFERENCES h5p_attempts(id) ON DELETE CASCADE,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (h5p_content_id) REFERENCES h5p_content(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for H5P tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_h5p_content_created_by ON h5p_content(created_by);
    CREATE INDEX IF NOT EXISTS idx_h5p_content_type ON h5p_content(content_type);
    CREATE INDEX IF NOT EXISTS idx_h5p_assignments_assigned_to ON h5p_assignments(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_h5p_assignments_content ON h5p_assignments(h5p_content_id);
    CREATE INDEX IF NOT EXISTS idx_h5p_attempts_assignment ON h5p_attempts(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_h5p_attempts_profile ON h5p_attempts(profile_id);
    CREATE INDEX IF NOT EXISTS idx_h5p_xapi_logs_attempt ON h5p_xapi_logs(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_h5p_xapi_logs_verb ON h5p_xapi_logs(verb);
  `);

  console.log('✅ H5P content tables created');

  // ==================== FAMILIES TABLE ====================
  // Families table - each family is a separate unit with its own members
  // Admin creates and controls families, parents manage their family members
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'suspended')),
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE SET NULL
    )
  `);

  // Migration: Add family_id column to profiles table
  try {
    const profileColumns = db.prepare('PRAGMA table_info(profiles)').all() as any[];
    const hasFamilyId = profileColumns.some((col: any) => col.name === 'family_id');

    if (!hasFamilyId) {
      console.log('🔄 Migrating profiles table: adding family_id column...');
      db.prepare('ALTER TABLE profiles ADD COLUMN family_id INTEGER REFERENCES families(id) ON DELETE SET NULL').run();
      db.prepare('CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON profiles(family_id)').run();
      console.log('✅ Migration completed: family_id column added to profiles');

      // Auto-create families for existing parent profiles and assign members
      console.log('🔄 Creating families for existing parent profiles...');
      const existingParents: any[] = db.prepare(`
        SELECT id, name FROM profiles WHERE type = 'parent'
      `).all();

      const insertFamily = db.prepare(`
        INSERT INTO families (name, description, created_by)
        VALUES (?, ?, ?)
      `);

      const updateProfileFamily = db.prepare(`
        UPDATE profiles SET family_id = ? WHERE id = ?
      `);

      const updateChildrenFamily = db.prepare(`
        UPDATE profiles SET family_id = ? WHERE parent_id = ?
      `);

      for (const parent of existingParents) {
        // Create family for this parent
        const familyName = `${parent.name}'s Family`;
        const result = insertFamily.run(familyName, 'Auto-created from existing data', parent.id);
        const familyId = result.lastInsertRowid;

        // Assign parent to family
        updateProfileFamily.run(familyId, parent.id);

        // Assign all children of this parent to the family
        updateChildrenFamily.run(familyId, parent.id);

        console.log(`  ✅ Created family "${familyName}" (ID: ${familyId}) for parent ${parent.name}`);
      }

      // Handle co-parents via guardian_students - they should be in the same family as the first parent
      const guardianLinks: any[] = db.prepare(`
        SELECT DISTINCT gs.guardian_id, p.family_id
        FROM guardian_students gs
        JOIN profiles p ON p.id IN (
          SELECT student_id FROM guardian_students WHERE guardian_id = gs.guardian_id
        )
        WHERE p.family_id IS NOT NULL
        AND (SELECT family_id FROM profiles WHERE id = gs.guardian_id) IS NULL
      `).all();

      for (const link of guardianLinks) {
        updateProfileFamily.run(link.family_id, link.guardian_id);
        console.log(`  ✅ Linked guardian ${link.guardian_id} to family ${link.family_id}`);
      }

      console.log('✅ Family migration completed');
    }
  } catch (error: any) {
    console.error('Migration error (families):', error.message);
  }

  // Create indexes for families
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_families_status ON families(status);
    CREATE INDEX IF NOT EXISTS idx_families_created_by ON families(created_by);
  `);

  console.log('✅ Families table created');

  // Run production-ready migrations
  runProductionReadyMigrations();

  console.log('Database initialized successfully');
}

export default db;
