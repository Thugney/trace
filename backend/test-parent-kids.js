import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Checking parent children at ${dbPath}`);

const db = new Database(dbPath);

// Check parent with ID 2
const parentId = 2;
const kids = db.prepare('SELECT id, name FROM profiles WHERE parent_id = ?').all(parentId);
console.log(`Kids for parent ${parentId}:`, kids);

// Check ai_suggestions table for those kids
const kidIds = kids.map(k => k.id);
if (kidIds.length > 0) {
  const suggestions = db.prepare(`
    SELECT s.*, p.name as child_name
    FROM ai_suggestions s
    INNER JOIN profiles p ON s.profile_id = p.id
    WHERE s.profile_id IN (${kidIds.join(',')}) AND s.status = 'pending'
    ORDER BY s.created_at DESC
  `).all();
  console.log('Pending suggestions:', suggestions);
} else {
  console.log('No kids, no suggestions');
}

// Check if ai_suggestions table has any rows
const allSuggestions = db.prepare('SELECT COUNT(*) as count FROM ai_suggestions').get();
console.log('Total ai_suggestions rows:', allSuggestions.count);

db.close();