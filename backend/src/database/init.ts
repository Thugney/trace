import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

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
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    CREATE INDEX IF NOT EXISTS idx_progress_profile ON progress(profile_id);
    CREATE INDEX IF NOT EXISTS idx_food_items_name ON food_items(name);
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile ON ai_conversations(profile_id);
    CREATE INDEX IF NOT EXISTS idx_notes_profile ON notes(profile_id);
    CREATE INDEX IF NOT EXISTS idx_monthly_goals_profile_month ON monthly_goals(profile_id, month);
    CREATE INDEX IF NOT EXISTS idx_ai_settings_profile ON ai_settings(profile_id);
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

  // School Assignments (homework, psalms, videos)
  db.exec(`
    CREATE TABLE IF NOT EXISTS school_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      class_id INTEGER NOT NULL,
      teacher_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT CHECK(type IN ('homework', 'psalm', 'alphabet', 'video', 'other')) DEFAULT 'homework',
      youtube_link TEXT,
      attachment_url TEXT,
      due_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES school_classes(id) ON DELETE CASCADE,
      FOREIGN KEY (teacher_id) REFERENCES profiles(id) ON DELETE CASCADE
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
      // Default: AI disabled for everyone, admin can enable it per student
      db.prepare('ALTER TABLE profiles ADD COLUMN ai_enabled INTEGER DEFAULT 0').run();
      console.log('✅ Migration completed: ai_enabled column added');
    }
  } catch (error: any) {
    console.error('Migration error (ai_enabled):', error.message);
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

  console.log('✅ Database initialized successfully');
}

export default db;
