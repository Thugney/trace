// Database diagnostic tool
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '../data/family.db');
const db = new Database(DB_PATH);

console.log('=== DATABASE DIAGNOSTIC REPORT ===\n');
console.log(`Database: ${DB_PATH}\n`);

// Check all profiles
console.log('--- ALL PROFILES ---');
const profiles = db.prepare('SELECT id, name, type, username, parent_id, ai_enabled, pin, password FROM profiles').all();

if (profiles.length === 0) {
  console.log('❌ NO PROFILES FOUND IN DATABASE');
} else {
  console.log(`Total profiles: ${profiles.length}\n`);

  profiles.forEach(p => {
    console.log(`ID: ${p.id}`);
    console.log(`  Name: ${p.name}`);
    console.log(`  Type: ${p.type}`);
    console.log(`  Username: ${p.username || 'NOT SET'}`);
    console.log(`  Parent ID: ${p.parent_id || 'N/A'}`);
    console.log(`  AI Enabled: ${p.ai_enabled || 0}`);
    console.log(`  Has PIN: ${p.pin ? 'YES (encrypted)' : 'NO'}`);
    console.log(`  Has Password: ${p.password ? 'YES (encrypted)' : 'NO'}`);
    console.log('');
  });
}

// Check admin profiles specifically
console.log('--- ADMIN PROFILES ---');
const admins = profiles.filter(p => p.type === 'admin');
if (admins.length === 0) {
  console.log('❌ NO ADMIN PROFILES FOUND');
  console.log('   You need to create an admin profile to manage the system\n');
} else {
  admins.forEach(a => {
    console.log(`✓ Admin: ${a.name} (ID: ${a.id}, Username: ${a.username || 'NOT SET'})`);
    if (!a.password && !a.pin) {
      console.log('  ⚠️  WARNING: No credentials set - cannot login!');
    }
  });
  console.log('');
}

// Check tasks
console.log('--- TASKS SUMMARY ---');
const taskStats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed,
    SUM(CASE WHEN parent_approved = 0 THEN 1 ELSE 0 END) as pending_approval
  FROM tasks
`).get();
console.log(`Total tasks: ${taskStats.total}`);
console.log(`Completed: ${taskStats.completed}`);
console.log(`Pending approval: ${taskStats.pending_approval}\n`);

// Check goals
console.log('--- GOALS SUMMARY ---');
const goalStats = db.prepare(`
  SELECT
    COUNT(*) as total,
    SUM(CASE WHEN achieved = 1 THEN 1 ELSE 0 END) as achieved,
    SUM(CASE WHEN parent_approved = 0 THEN 1 ELSE 0 END) as pending_approval
  FROM monthly_goals
`).get();
console.log(`Total goals: ${goalStats.total}`);
console.log(`Achieved: ${goalStats.achieved}`);
console.log(`Pending approval: ${goalStats.pending_approval}\n`);

// Check notes
console.log('--- NOTES SUMMARY ---');
const notesCount = db.prepare('SELECT COUNT(*) as count FROM notes').get();
console.log(`Total notes: ${notesCount.count}\n`);

db.close();
console.log('=== END DIAGNOSTIC REPORT ===');
