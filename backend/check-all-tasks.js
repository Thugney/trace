const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('=== ALL TASKS IN DATABASE ===\n');

const tasks = db.prepare(`
  SELECT t.*, p.name as profile_name, p.type as profile_type
  FROM tasks t
  LEFT JOIN profiles p ON t.profile_id = p.id
  ORDER BY t.profile_id, t.completed, t.created_at DESC
`).all();

console.log(`Total tasks: ${tasks.length}\n`);

if (tasks.length === 0) {
  console.log('No tasks found in the database!');
} else {
  // Group by profile
  const byProfile = {};
  tasks.forEach(t => {
    const key = `${t.profile_name || 'Unknown'} (ID: ${t.profile_id})`;
    if (!byProfile[key]) byProfile[key] = [];
    byProfile[key].push(t);
  });

  Object.entries(byProfile).forEach(([profile, tasks]) => {
    console.log(`\n${profile} [${tasks[0]?.profile_type || 'unknown'}]:`);
    console.log(`  Tasks: ${tasks.length}`);
    tasks.forEach(t => {
      let status = t.completed ? '✓' : '○';
      let info = `  ${status} "${t.title}" (${t.category}, ${t.points}pts)`;
      if (t.requires_timer) info += ` [Timer: ${t.timer_duration_minutes}min]`;
      console.log(info);
    });
  });
}

console.log('\n\n=== ALL PROFILES ===\n');
const profiles = db.prepare(`
  SELECT id, name, type, family_id, parent_id
  FROM profiles
  ORDER BY type, name
`).all();

profiles.forEach(p => {
  const taskCount = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE profile_id = ?').get(p.id);
  console.log(`${p.type.padEnd(8)} | ${p.name.padEnd(15)} (ID: ${p.id}) | Tasks: ${taskCount.count}`);
});

console.log('\n\n=== TASK TABLE SCHEMA ===\n');
try {
  const schema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'").get();
  console.log(schema?.sql || 'Table not found');
} catch (e) {
  console.log('Error:', e.message);
}

db.close();
