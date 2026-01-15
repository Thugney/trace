import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Checking columns at ${dbPath}`);

const db = new Database(dbPath);

const tables = {
  tasks: ['due_date', 'proof_required', 'updated_at'],
  proofs: ['updated_at', 'comment', 'verified_by', 'verified_at', 'version'],
  meal_logs: ['logged_at', 'calories_consumed'],
  progress: ['logged_at', 'total_points', 'total_stars', 'level'],
  ai_suggestions: ['profile_id', 'status'],
  ai_conversations: ['profile_id', 'context', 'user_message', 'ai_response']
};

for (const [table, columns] of Object.entries(tables)) {
  try {
    const info = db.prepare(`PRAGMA table_info(${table})`).all();
    const existingColumns = info.map(col => col.name);
    console.log(`\n${table} columns:`, existingColumns);
    for (const col of columns) {
      if (!existingColumns.includes(col)) {
        console.log(`❌ Missing column ${table}.${col}`);
      }
    }
  } catch (e) {
    console.log(`Error reading table ${table}:`, e.message);
  }
}

db.close();