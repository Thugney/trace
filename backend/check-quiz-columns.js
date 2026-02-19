import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Checking quiz columns at ${dbPath}`);

const db = new Database(dbPath);

const tables = ['family_quizzes', 'family_quiz_questions', 'family_quiz_attempts'];

for (const table of tables) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    console.log(`\n${table} columns:`);
    for (const col of info) {
      console.log(`  ${col.name} ${col.type} ${col.notnull ? 'NOT NULL' : ''} default=${col.dflt_value}`);
    }
  } catch (e) {
    console.log(`Error reading table ${table}:`, e.message);
  }
}

db.close();