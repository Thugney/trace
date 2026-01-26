const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('=== CHECKING KIDS PROFILES AND THEIR TASKS ===\n');

// Get all child profiles
const kids = db.prepare(`
  SELECT p.id, p.name, p.parent_id, p.family_id, f.name as family_name
  FROM profiles p
  LEFT JOIN families f ON p.family_id = f.id
  WHERE p.type = 'child'
`).all();

console.log(`Found ${kids.length} kid profile(s):\n`);

kids.forEach(kid => {
  console.log(`\n========================================`);
  console.log(`KID: ${kid.name} (ID: ${kid.id})`);
  console.log(`  Parent ID: ${kid.parent_id}, Family: ${kid.family_name || 'None'}`);
  console.log(`========================================\n`);

  // Get their tasks
  const tasks = db.prepare(`
    SELECT
      id, title, category, points, completed,
      requires_timer, timer_duration_minutes,
      due_date, scheduled_time, last_completed_date,
      created_at, completed_at,
      proof_required, proof_photo_url
    FROM tasks
    WHERE profile_id = ?
    ORDER BY completed ASC, created_at DESC
  `).all(kid.id);

  console.log(`  Total Tasks: ${tasks.length}`);
  const completedCount = tasks.filter(t => t.completed).length;
  const pendingCount = tasks.length - completedCount;
  console.log(`  Completed: ${completedCount}, Pending: ${pendingCount}`);

  // Check for unusual patterns
  const timerTasks = tasks.filter(t => t.requires_timer);
  console.log(`  Tasks with Timer: ${timerTasks.length}`);

  // Check active timer states
  const activeTimers = db.prepare(`
    SELECT ts.*, t.title as task_title
    FROM timer_states ts
    LEFT JOIN tasks t ON ts.task_id = t.id
    WHERE ts.profile_id = ? AND ts.timer_type = 'task'
  `).all(kid.id);

  if (activeTimers.length > 0) {
    console.log(`\n  ⚠️ ACTIVE TIMER STATES: ${activeTimers.length}`);
    activeTimers.forEach(timer => {
      console.log(`    - Task: "${timer.task_title}" (ID: ${timer.task_id})`);
      console.log(`      Running: ${timer.is_running}, Paused: ${timer.is_paused}`);
      console.log(`      Elapsed: ${timer.elapsed_seconds}s`);
      console.log(`      Start: ${timer.start_time}`);
      if (timer.is_paused) console.log(`      Paused at: ${timer.pause_time}`);
    });
  }

  // Check for duplicate tasks (same title)
  const titleCounts = {};
  tasks.forEach(t => {
    titleCounts[t.title] = (titleCounts[t.title] || 0) + 1;
  });
  const duplicates = Object.entries(titleCounts).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log(`\n  ⚠️ DUPLICATE TASK TITLES:`);
    duplicates.forEach(([title, count]) => {
      console.log(`    - "${title}" appears ${count} times`);
    });
  }

  // Check for unusual timer durations
  const weirdTimers = tasks.filter(t =>
    t.requires_timer && (t.timer_duration_minutes === null || t.timer_duration_minutes === 0)
  );
  if (weirdTimers.length > 0) {
    console.log(`\n  ⚠️ TASKS WITH TIMER BUT NO DURATION:`);
    weirdTimers.forEach(t => {
      console.log(`    - "${t.title}" (requires_timer=${t.requires_timer}, duration=${t.timer_duration_minutes})`);
    });
  }

  // Check completed today tasks
  const today = new Date().toISOString().split('T')[0];
  const completedToday = tasks.filter(t =>
    t.last_completed_date && t.last_completed_date.startsWith(today)
  );
  if (completedToday.length > 0) {
    console.log(`\n  ✅ COMPLETED TODAY (${today}):`);
    completedToday.forEach(t => {
      console.log(`    - "${t.title}" (+${t.points} pts)`);
    });
  }

  // List all pending tasks
  const pending = tasks.filter(t => !t.completed);
  if (pending.length > 0) {
    console.log(`\n  📋 PENDING TASKS:`);
    pending.forEach(t => {
      let info = `    - "${t.title}" (${t.category}, ${t.points} pts)`;
      if (t.requires_timer) info += ` [Timer: ${t.timer_duration_minutes || '?'}min]`;
      if (t.proof_required) info += ` [Photo Required]`;
      if (t.scheduled_time) info += ` [Scheduled: ${t.scheduled_time}]`;
      console.log(info);
    });
  }

  // Show completed tasks
  const completed = tasks.filter(t => t.completed);
  if (completed.length > 0) {
    console.log(`\n  ✓ COMPLETED TASKS:`);
    completed.slice(0, 5).forEach(t => {
      let info = `    - "${t.title}" (${t.points} pts)`;
      if (t.completed_at) info += ` @ ${t.completed_at.split('T')[0]}`;
      console.log(info);
    });
    if (completed.length > 5) {
      console.log(`    ... and ${completed.length - 5} more`);
    }
  }
});

// Check for orphaned timer states (no matching task or wrong profile)
console.log('\n\n=== CHECKING FOR ORPHANED/STALE TIMER STATES ===\n');
const allTimers = db.prepare(`
  SELECT ts.*, t.title as task_title, t.profile_id as task_profile_id, p.name as profile_name
  FROM timer_states ts
  LEFT JOIN tasks t ON ts.task_id = t.id
  LEFT JOIN profiles p ON ts.profile_id = p.id
  WHERE ts.timer_type = 'task'
`).all();

if (allTimers.length === 0) {
  console.log('No active timer states found.');
} else {
  console.log(`Found ${allTimers.length} timer state(s):`);
  allTimers.forEach(ts => {
    console.log(`\n  Timer State ID: ${ts.id}`);
    console.log(`    Profile: ${ts.profile_name} (ID: ${ts.profile_id})`);
    console.log(`    Task: "${ts.task_title || 'MISSING'}" (ID: ${ts.task_id})`);

    if (!ts.task_title) {
      console.log(`    ⚠️ ORPHANED: Task not found!`);
    }
    if (ts.task_profile_id && ts.task_profile_id !== ts.profile_id) {
      console.log(`    ⚠️ MISMATCH: Timer profile (${ts.profile_id}) != Task profile (${ts.task_profile_id})`);
    }

    console.log(`    State: running=${ts.is_running}, paused=${ts.is_paused}, elapsed=${ts.elapsed_seconds}s`);
    console.log(`    Started: ${ts.start_time}`);
    console.log(`    Last Updated: ${ts.last_updated}`);

    // Check if timer is stale (>24 hours old)
    if (ts.start_time) {
      const startTime = new Date(ts.start_time);
      const now = new Date();
      const hoursDiff = (now - startTime) / (1000 * 60 * 60);
      if (hoursDiff > 24) {
        console.log(`    ⚠️ STALE: Timer started ${Math.floor(hoursDiff)} hours ago!`);
      }
    }
  });
}

db.close();
