import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Checking database at ${dbPath}`);

const db = new Database(dbPath);

const tables = ['proofs', 'ai_suggestions', 'ai_conversations', 'meal_logs', 'task_proofs'];
const existingTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row => row.name);

console.log('Existing tables:');
existingTables.forEach(t => console.log(`  - ${t}`));

for (const table of tables) {
  if (existingTables.includes(table)) {
    console.log(`✅ Table ${table} exists`);
  } else {
    console.log(`❌ Table ${table} MISSING`);
  }
}

// Check profiles avatar column sample
try {
  const sample = db.prepare('SELECT id, name, avatar FROM profiles LIMIT 5').all();
  console.log('\nSample profiles:');
  sample.forEach(p => console.log(`  ${p.id}: ${p.name} - avatar: ${p.avatar}`));

  // Check for any profiles still using old avatar paths
  const oldAvatars = db.prepare("SELECT id, name, avatar FROM profiles WHERE avatar LIKE '/avatars/%'").all();
  if (oldAvatars.length > 0) {
    console.log('\n⚠️  Profiles with old avatar paths:');
    oldAvatars.forEach(p => console.log(`  ${p.id}: ${p.name} - avatar: ${p.avatar}`));
  } else {
    console.log('\n✅ No profiles with old avatar paths');
  }

  // Check specific profiles with stats errors
  const specificIds = [3,4,7,8];
  const specificProfiles = db.prepare('SELECT id, name, avatar FROM profiles WHERE id IN (' + specificIds.join(',') + ')').all();
  console.log('\nProfiles with stats errors:');
  specificProfiles.forEach(p => console.log(`  ${p.id}: ${p.name} - avatar: ${p.avatar}`));
} catch (e) {
  console.log('Error reading profiles:', e.message);
}

db.close();