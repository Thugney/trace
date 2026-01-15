import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Testing proofs status at ${dbPath}`);

const db = new Database(dbPath);

const parentId = 2;
const since = null;

try {
  // Check if parent exists
  const parent = db.prepare('SELECT id, name, type FROM profiles WHERE id = ?').get(parentId);
  console.log('Parent:', parent);

  // Check children
  const kids = db.prepare('SELECT id, name FROM profiles WHERE parent_id = ?').all(parentId);
  console.log('Kids:', kids);

  // Query from endpoint (parent, no since)
  const query = `
    SELECT
      t.id as task_id,
      t.title,
      t.description,
      t.proof_photo_url,
      t.completed,
      t.created_at as task_created_at,
      p.id as child_id,
      p.name as child_name,
      p.avatar as child_avatar,
      pr.status as proof_status,
      pr.updated_at as proof_updated_at,
      pr.comment as proof_comment,
      pr.verified_by,
      pr.verified_at,
      pr.version as proof_version
    FROM tasks t
    JOIN profiles p ON t.profile_id = p.id
    LEFT JOIN proofs pr ON t.id = pr.task_id
    WHERE p.parent_id = ?
      AND t.proof_required = 1
    ORDER BY COALESCE(pr.updated_at, t.updated_at) DESC
    LIMIT 50
  `;
  const params = [parentId];
  const results = db.prepare(query).all(...params);
  console.log('Results count:', results.length);
  if (results.length > 0) {
    console.log('First result:', results[0]);
  }
} catch (e) {
  console.log('Error:', e.message);
  console.log('Stack:', e.stack);
}

db.close();