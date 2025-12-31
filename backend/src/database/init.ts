import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../../data/family.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db: Database.Database = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export function initDatabase() {
  console.log('📦 Initializing database...');

  // Profiles table
  db.exec(`
    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('parent', 'child')),
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
      category TEXT CHECK(category IN ('read-book', 'tigrinya', 'clean-room', 'clean-kitchen', 'school', 'other')),
      points INTEGER DEFAULT 10,
      difficulty TEXT CHECK(difficulty IN ('easy', 'medium', 'hard')) DEFAULT 'easy',
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
      profile_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT CHECK(type IN ('virtual', 'real')) DEFAULT 'virtual',
      points_required INTEGER NOT NULL,
      icon TEXT,
      is_claimed BOOLEAN DEFAULT 0,
      claimed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
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

  // Settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for better performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_meal_logs_profile ON meal_logs(profile_id);
    CREATE INDEX IF NOT EXISTS idx_meal_logs_date ON meal_logs(logged_at);
    CREATE INDEX IF NOT EXISTS idx_tasks_profile ON tasks(profile_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
    CREATE INDEX IF NOT EXISTS idx_progress_profile ON progress(profile_id);
    CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile ON ai_conversations(profile_id);
  `);

  // Insert default settings if none exist
  const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get() as { count: number };

  if (settingsCount.count === 0) {
    console.log('📝 Creating default settings...');

    const settings = [
      { key: 'grok_api_enabled', value: 'false' },
      { key: 'norwegian_food_api', value: 'matvaretabellen' },
      { key: 'parent_pin', value: '' }
    ];

    const insertSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    settings.forEach(setting => {
      insertSetting.run(setting.key, setting.value);
    });

    console.log('✅ Default settings created');
  }

  console.log('✅ Database initialized successfully');
}

export default db;
