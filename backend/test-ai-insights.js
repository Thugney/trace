import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Testing AI insights at ${dbPath}`);

const db = new Database(dbPath);

const parentId = 2;
const days = 7;

try {
  // Get children of parent
  const kids = db.prepare('SELECT id FROM profiles WHERE parent_id = ?').all(parentId);
  const childIds = kids.map(k => k.id);
  console.log('Child IDs:', childIds);

  if (childIds.length === 0) {
    console.log('No children, returning empty');
  } else {
    const placeholders = childIds.map(() => '?').join(',');

    // Get encouragement logs
    const encouragementLogs = db.prepare(`
      SELECT
        ac.profile_id,
        ac.user_message as topic,
        ac.ai_response as details,
        ac.created_at,
        p.name as child_name,
        p.avatar as child_avatar
      FROM ai_conversations ac
      JOIN profiles p ON ac.profile_id = p.id
      WHERE ac.profile_id IN (${placeholders})
        AND ac.context = 'encouragement'
        AND ac.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ac.created_at DESC
      LIMIT 20
    `).all(...childIds, days);
    console.log('Encouragement logs count:', encouragementLogs.length);

    // Get quiz suggestions
    const quizSuggestions = db.prepare(`
      SELECT
        ac.profile_id,
        ac.user_message as suggestion,
        ac.ai_response as details,
        ac.created_at,
        p.name as child_name
      FROM ai_conversations ac
      JOIN profiles p ON ac.profile_id = p.id
      WHERE ac.profile_id IN (${placeholders})
        AND ac.context = 'quiz_suggestion'
        AND ac.created_at >= datetime('now', '-' || ? || ' days')
      ORDER BY ac.created_at DESC
      LIMIT 10
    `).all(...childIds, days);
    console.log('Quiz suggestions count:', quizSuggestions.length);

    // Parse (simplified)
    console.log('No errors.');
  }
} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);
}

db.close();