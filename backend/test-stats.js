import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Testing stats queries at ${dbPath}`);

const db = new Database(dbPath);

const testIds = [3,4,7,8];

for (const id of testIds) {
  console.log(`\n--- Testing profile ${id} ---`);
  try {
    // Task stats
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
      WHERE profile_id = ?
    `).get(id);
    console.log('Task stats:', taskStats);

    // Progress stats
    const progressStats = db.prepare(`
      SELECT
        total_points,
        total_stars,
        level
      FROM progress
      WHERE profile_id = ?
      ORDER BY logged_at DESC
      LIMIT 1
    `).get(id);
    console.log('Progress stats:', progressStats);

    // Diet stats
    const dietStats = db.prepare(`
      SELECT
        COUNT(*) as meals_logged,
        SUM(calories_consumed) as total_calories,
        DATE(logged_at) as log_date
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE('now')
      GROUP BY DATE(logged_at)
    `).get(id);
    console.log('Diet stats:', dietStats);
  } catch (e) {
    console.log(`Error for profile ${id}:`, e.message);
  }
}

db.close();