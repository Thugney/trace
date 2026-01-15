import db from '../init.js';

/**
 * Migration to fix profiles table schema to match code expectations
 * - Adds missing columns: name, type, pin, password, ai_enabled, gender, etc.
 * - Renames/updates existing columns as needed
 */
export function fixProfilesSchema() {
  console.log('🔄 Fixing profiles table schema...');

  try {
    // Check current table structure
    const columns = db.prepare("PRAGMA table_info(profiles)").all() as { name: string }[];
    const columnNames = columns.map(col => col.name);

    console.log('Current columns:', columnNames);

    // Add missing columns
    const missingColumns = [
      { name: 'name', sql: 'ALTER TABLE profiles ADD COLUMN name TEXT' },
      { name: 'type', sql: "ALTER TABLE profiles ADD COLUMN type TEXT DEFAULT 'child'" },
      { name: 'pin', sql: 'ALTER TABLE profiles ADD COLUMN pin TEXT' },
      { name: 'password', sql: 'ALTER TABLE profiles ADD COLUMN password TEXT' },
      { name: 'ai_enabled', sql: 'ALTER TABLE profiles ADD COLUMN ai_enabled BOOLEAN DEFAULT 0' },
      { name: 'gender', sql: 'ALTER TABLE profiles ADD COLUMN gender TEXT' },
      { name: 'diet_enabled', sql: 'ALTER TABLE profiles ADD COLUMN diet_enabled BOOLEAN DEFAULT 0' },
      { name: 'settings', sql: 'ALTER TABLE profiles ADD COLUMN settings TEXT' },
      { name: 'assigned_class_id', sql: 'ALTER TABLE profiles ADD COLUMN assigned_class_id INTEGER REFERENCES school_classes(id)' },
      { name: 'avatar', sql: 'ALTER TABLE profiles ADD COLUMN avatar TEXT' }
    ];

    for (const col of missingColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`Adding column: ${col.name}`);
        db.prepare(col.sql).run();
      }
    }

    // Check if we need to migrate data from old columns
    if (columnNames.includes('display_name') && !columnNames.includes('name')) {
      console.log('Migrating display_name to name...');
      db.prepare('UPDATE profiles SET name = display_name WHERE name IS NULL').run();
    }

    if (columnNames.includes('role') && !columnNames.includes('type')) {
      console.log('Migrating role to type...');
      db.prepare("UPDATE profiles SET type = role WHERE type IS NULL").run();
    }

    if (columnNames.includes('password_hash') && !columnNames.includes('password')) {
      console.log('Migrating password_hash to password...');
      db.prepare('UPDATE profiles SET password = password_hash WHERE password IS NULL').run();
    }

    if (columnNames.includes('avatar_url') && !columnNames.includes('avatar')) {
      console.log('Migrating avatar_url to avatar...');
      db.prepare('UPDATE profiles SET avatar = avatar_url WHERE avatar IS NULL').run();
    }

    console.log('✅ Profiles table schema fixed');
  } catch (error: any) {
    console.error('Migration error:', error.message);
  }
}