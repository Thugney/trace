const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('=== PUSH NOTIFICATION SYSTEM STATUS ===\n');

// Check push subscriptions
console.log('1. PUSH SUBSCRIPTIONS:');
const subscriptions = db.prepare(`
  SELECT ps.*, p.name as profile_name
  FROM push_subscriptions ps
  LEFT JOIN profiles p ON ps.profile_id = p.id
`).all();

if (subscriptions.length === 0) {
  console.log('   ⚠️ NO PUSH SUBSCRIPTIONS FOUND');
  console.log('   Users need to enable notifications in the app first!');
} else {
  console.log(`   Found ${subscriptions.length} subscription(s):`);
  subscriptions.forEach(sub => {
    console.log(`   - ${sub.profile_name} (ID: ${sub.profile_id})`);
    console.log(`     Endpoint: ${sub.endpoint.substring(0, 60)}...`);
  });
}

// Check reminder preferences
console.log('\n2. REMINDER PREFERENCES:');
const prefs = db.prepare(`
  SELECT rp.*, p.name as profile_name, p.type as profile_type
  FROM reminder_preferences rp
  JOIN profiles p ON p.id = rp.profile_id
`).all();

if (prefs.length === 0) {
  console.log('   No custom reminder preferences set (default: 07:30 AM)');
} else {
  prefs.forEach(pref => {
    console.log(`   - ${pref.profile_name} (${pref.profile_type}): ${pref.reminder_enabled ? 'ENABLED' : 'DISABLED'} at ${pref.morning_reminder_time || '07:30'}`);
  });
}

// Check child profiles for reminder eligibility
console.log('\n3. CHILDREN ELIGIBLE FOR REMINDERS:');
const children = db.prepare(`
  SELECT p.id, p.name
  FROM profiles p
  WHERE p.type = 'child'
`).all();

children.forEach(child => {
  const tasks = db.prepare(`
    SELECT COUNT(*) as count FROM tasks WHERE profile_id = ? AND completed = 0
  `).get(child.id);
  console.log(`   - ${child.name} (ID: ${child.id}): ${tasks.count} pending tasks`);
});

// Check for scheduled tasks
console.log('\n4. TASKS WITH SCHEDULED REMINDERS:');
const scheduledTasks = db.prepare(`
  SELECT t.id, t.title, t.scheduled_time, t.last_reminder_sent, p.name as profile_name
  FROM tasks t
  JOIN profiles p ON t.profile_id = p.id
  WHERE t.scheduled_time IS NOT NULL
`).all();

if (scheduledTasks.length === 0) {
  console.log('   No tasks with scheduled reminder times');
} else {
  scheduledTasks.forEach(task => {
    console.log(`   - "${task.title}" for ${task.profile_name} at ${task.scheduled_time}`);
    console.log(`     Last reminder: ${task.last_reminder_sent || 'Never'}`);
  });
}

// Check recent notifications sent
console.log('\n5. RECENT NOTIFICATIONS (last 10):');
const notifications = db.prepare(`
  SELECT n.*, p.name as profile_name
  FROM notifications n
  LEFT JOIN profiles p ON n.profile_id = p.id
  ORDER BY n.created_at DESC
  LIMIT 10
`).all();

if (notifications.length === 0) {
  console.log('   No notifications in database');
} else {
  notifications.forEach(n => {
    const readStatus = n.read_at ? '✓' : '○';
    console.log(`   ${readStatus} [${n.type}] "${n.title}" to ${n.profile_name}`);
    console.log(`     ${n.created_at}`);
  });
}

db.close();
