import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Fixing ai_conversations table at ${dbPath}`);

const db = new Database(dbPath);

try {
  // Check if table exists
  const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_conversations'").get();
  if (!tableExists) {
    console.log('Table ai_conversations does not exist, creating...');
    createNewTable();
    console.log('✅ Created new ai_conversations table');
    db.close();
    process.exit(0);
  }

  // Get column info
  const columns = db.prepare('PRAGMA table_info(ai_conversations)').all();
  const columnNames = columns.map(col => col.name);
  console.log('Current columns:', columnNames);

  const hasContext = columnNames.includes('context');
  const hasUserMessage = columnNames.includes('user_message');
  const hasAiResponse = columnNames.includes('ai_response');

  if (!hasContext || !hasUserMessage || !hasAiResponse) {
    console.log('Old schema detected, dropping table...');
    db.prepare('DROP TABLE ai_conversations').run();
    console.log('✅ Dropped old table');
    createNewTable();
    console.log('✅ Created new table with correct schema');
  } else {
    console.log('✅ Table already has correct schema');
  }
} catch (e) {
  console.error('Error fixing ai_conversations:', e.message);
  console.error(e.stack);
}

function createNewTable() {
  db.prepare(`
    CREATE TABLE ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      context TEXT NOT NULL DEFAULT 'general',
      user_message TEXT NOT NULL,
      ai_response TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `).run();

  db.prepare(`
    CREATE INDEX IF NOT EXISTS idx_ai_conversations_profile ON ai_conversations(profile_id)
  `).run();
}

db.close();
console.log('Done.');