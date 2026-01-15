import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Checking profiles at ${dbPath}`);

const db = new Database(dbPath);

try {
  const allProfiles = db.prepare('SELECT id, name, type, gender, avatar FROM profiles ORDER BY id').all();
  console.log('All profiles:');
  allProfiles.forEach(p => console.log(`  ${p.id}: ${p.name} (${p.type}, ${p.gender}) - avatar: ${p.avatar}`));

  const specificIds = [3,4,7,8];
  const specificProfiles = db.prepare('SELECT id, name, avatar FROM profiles WHERE id IN (' + specificIds.join(',') + ')').all();
  console.log('\nProfiles with stats errors:');
  specificProfiles.forEach(p => console.log(`  ${p.id}: ${p.name} - avatar: ${p.avatar}`));
  const missingIds = specificIds.filter(id => !specificProfiles.some(p => p.id === id));
  if (missingIds.length > 0) {
    console.log('Missing profile IDs:', missingIds);
  }
} catch (e) {
  console.log('Error reading profiles:', e.message);
}

db.close();