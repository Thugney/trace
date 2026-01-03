// Seed database with test data
const Database = require('better-sqlite3');
const bcrypt = require('bcrypt');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/family.db');
const db = new Database(DB_PATH);

console.log('🌱 Seeding database with test data...\n');

const SALT_ROUNDS = 10;

async function seed() {
  // Clear existing data
  console.log('Clearing existing data...');
  db.prepare('DELETE FROM notes').run();
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM monthly_goals').run();
  db.prepare('DELETE FROM progress').run();
  db.prepare('DELETE FROM ai_conversations').run();
  db.prepare('DELETE FROM ai_settings').run();
  db.prepare('DELETE FROM profiles').run();

  // Create Admin (Robel)
  console.log('\n📝 Creating admin profile...');
  const adminPassword = await bcrypt.hash('admin123', SALT_ROUNDS);
  const adminResult = db.prepare(`
    INSERT INTO profiles (name, type, username, password, avatar, ai_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Robel', 'admin', 'robel', adminPassword, '👨‍💼', 1);
  const adminId = adminResult.lastInsertRowid;
  console.log(`✅ Admin created: Robel (ID: ${adminId}, username: robel, password: admin123)`);

  // Create Parent
  console.log('\n📝 Creating parent profile...');
  const parentPassword = await bcrypt.hash('parent123', SALT_ROUNDS);
  const parentResult = db.prepare(`
    INSERT INTO profiles (name, type, username, password, avatar, age, gender, ai_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Sarah', 'parent', 'sarah', parentPassword, '👩', 35, 'female', 1);
  const parentId = parentResult.lastInsertRowid;
  console.log(`✅ Parent created: Sarah (ID: ${parentId}, username: sarah, password: parent123)`);

  // Create Kids
  console.log('\n📝 Creating kid profiles...');
  const betiPin = await bcrypt.hash('1234', SALT_ROUNDS);
  const betiResult = db.prepare(`
    INSERT INTO profiles (name, type, pin, avatar, age, gender, parent_id, ai_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Beti', 'child', betiPin, '👧', 10, 'female', parentId, 1);
  const betiId = betiResult.lastInsertRowid;
  console.log(`✅ Kid created: Beti (ID: ${betiId}, PIN: 1234, AI: enabled)`);

  const sisterPin = await bcrypt.hash('5678', SALT_ROUNDS);
  const sisterResult = db.prepare(`
    INSERT INTO profiles (name, type, pin, avatar, age, gender, parent_id, ai_enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run('Mia', 'child', sisterPin, '👧', 8, 'female', parentId, 0);
  const sisterId = sisterResult.lastInsertRowid;
  console.log(`✅ Kid created: Mia (ID: ${sisterId}, PIN: 5678, AI: disabled)`);

  // Create Teacher
  console.log('\n📝 Creating teacher profile...');
  const teacherPassword = await bcrypt.hash('teacher123', SALT_ROUNDS);
  const teacherResult = db.prepare(`
    INSERT INTO profiles (name, type, username, password, avatar, ai_enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('Mr. Smith', 'teacher', 'smith', teacherPassword, '👨‍🏫', 1);
  const teacherId = teacherResult.lastInsertRowid;
  console.log(`✅ Teacher created: Mr. Smith (ID: ${teacherId}, username: smith, password: teacher123)`);

  // Create AI settings for kids
  console.log('\n📝 Creating AI settings...');
  db.prepare(`
    INSERT INTO ai_settings (profile_id, strict_mode, max_messages_per_day, content_filter_level, custom_instructions)
    VALUES (?, ?, ?, ?, ?)
  `).run(betiId, 1, 20, 'strict', 'Always encourage learning and be positive');

  db.prepare(`
    INSERT INTO ai_settings (profile_id, strict_mode, max_messages_per_day, content_filter_level, custom_instructions)
    VALUES (?, ?, ?, ?, ?)
  `).run(sisterId, 1, 15, 'strict', '');
  console.log('✅ AI settings created');

  // Create sample tasks for Beti
  console.log('\n📝 Creating sample tasks...');

  // Approved task
  db.prepare(`
    INSERT INTO tasks (profile_id, title, description, category, points, difficulty, due_date, completed, parent_approved, created_by, approved_by)
    VALUES (?, ?, ?, ?, ?, ?, date('now', '+3 days'), 0, 1, ?, ?)
  `).run(betiId, 'Homework: Math', 'Complete exercises 1-10', 'school', 10, 'medium', betiId, parentId);

  // Pending approval task
  db.prepare(`
    INSERT INTO tasks (profile_id, title, description, category, points, difficulty, due_date, completed, parent_approved, created_by)
    VALUES (?, ?, ?, ?, ?, ?, date('now', '+5 days'), 0, 0, ?)
  `).run(betiId, 'Clean my room', 'Organize desk and closet', 'clean-room', 15, 'easy', betiId);

  // Completed task
  db.prepare(`
    INSERT INTO tasks (profile_id, title, description, category, points, difficulty, completed, completed_at, parent_approved, created_by, approved_by)
    VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now', '-2 days'), 1, ?, ?)
  `).run(betiId, 'Read a book', 'Finish chapter 5', 'read-book', 8, 'easy', betiId, parentId);

  console.log('✅ 3 sample tasks created');

  // Create sample goal
  console.log('\n📝 Creating sample goals...');
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Approved goal
  db.prepare(`
    INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, achieved, parent_approved, created_by, approved_by)
    VALUES (?, ?, ?, ?, 0, 1, ?, ?)
  `).run(betiId, currentMonth, 'Earn 50 points this month', 50, betiId, parentId);

  // Pending approval goal
  db.prepare(`
    INSERT INTO monthly_goals (profile_id, month, goal_description, goal_points, achieved, parent_approved, created_by)
    VALUES (?, ?, ?, ?, 0, 0, ?)
  `).run(betiId, currentMonth, 'Learn 10 new Norwegian words', 30, betiId);

  console.log('✅ 2 sample goals created');

  // Create sample notes
  console.log('\n📝 Creating sample notes...');
  db.prepare(`
    INSERT INTO notes (profile_id, title, content, color)
    VALUES (?, ?, ?, ?)
  `).run(betiId, 'My Ideas', 'Things I want to learn: coding, drawing, music', '#FFD700');

  db.prepare(`
    INSERT INTO notes (profile_id, title, content, color)
    VALUES (?, ?, ?, ?)
  `).run(betiId, 'Homework Reminder', 'Math due Friday, Science project next week', '#87CEEB');

  console.log('✅ 2 sample notes created');

  // Create progress record
  console.log('\n📝 Creating progress record...');
  db.prepare(`
    INSERT INTO progress (profile_id, total_points, total_stars, level)
    VALUES (?, ?, ?, ?)
  `).run(betiId, 18, 3, 2);
  console.log('✅ Progress record created');

  db.close();

  console.log('\n✅ DATABASE SEEDED SUCCESSFULLY!\n');
  console.log('=== LOGIN CREDENTIALS ===');
  console.log('Admin:   username: robel   | password: admin123');
  console.log('Parent:  username: sarah   | password: parent123');
  console.log('Kid 1:   name: Beti        | PIN: 1234 (AI enabled)');
  console.log('Kid 2:   name: Mia         | PIN: 5678 (AI disabled)');
  console.log('Teacher: username: smith   | password: teacher123');
  console.log('========================\n');
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
