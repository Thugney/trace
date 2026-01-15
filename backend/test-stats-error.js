import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const dbPath = process.env.DATABASE_PATH || join(__dirname, 'data', 'family.db');
console.log(`Testing stats endpoint at ${dbPath}`);

const db = new Database(dbPath);

function getStats(id) {
  try {
    // Get task stats for kids
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) as total_tasks,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed_tasks,
        SUM(CASE WHEN completed = 0 AND due_date < datetime('now') THEN 1 ELSE 0 END) as overdue_tasks
      FROM tasks
      WHERE profile_id = ?
    `).get(id);
    console.log('Task stats result:', taskStats);

    // Get progress stats
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
    console.log('Progress stats result:', progressStats);

    // Get diet stats
    const dietStats = db.prepare(`
      SELECT
        COUNT(*) as meals_logged,
        SUM(calories_consumed) as total_calories,
        DATE(logged_at) as log_date
      FROM meal_logs
      WHERE profile_id = ? AND DATE(logged_at) = DATE('now')
      GROUP BY DATE(logged_at)
    `).get(id);
    console.log('Diet stats result:', dietStats);

    return {
      tasks: taskStats || { total_tasks: 0, completed_tasks: 0, overdue_tasks: 0 },
      progress: progressStats || { total_points: 0, total_stars: 0, level: 1 },
      diet: dietStats || { meals_logged: 0, total_calories: 0 }
    };
  } catch (error) {
    console.error(`Error for profile ${id}:`, error.message);
    throw error;
  }
}

const ids = [3,4,7,8];
for (const id of ids) {
  console.log(`\n--- Testing profile ${id} ---`);
  try {
    const stats = getStats(id);
    console.log('Success:', stats);
  } catch (e) {
    console.log('Failed.');
  }
}

db.close();