/**
 * This script marks the AI migration as completed so that
 * admin settings are not overwritten on next container restart.
 *
 * Run with: cat backend/scripts/fix-ai-migration.js | sudo docker-compose exec -T backend node
 */

const Database = require('better-sqlite3');

const dbPath = process.env.DATABASE_PATH || '/app/data/family.db';
const db = new Database(dbPath);

try {
  // Check if migration marker already exists
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'migration_ai_enabled_initial'").get();

  if (existing) {
    console.log('✓ Migration marker already exists - no action needed');
  } else {
    // Add the migration marker to prevent future AI reset
    db.prepare("INSERT INTO settings (key, value) VALUES ('migration_ai_enabled_initial', 'completed')").run();
    console.log('✅ Added migration marker - AI settings will now persist across restarts');
  }

  // Show current AI status for all profiles
  const profiles = db.prepare("SELECT id, name, type, ai_enabled FROM profiles ORDER BY id").all();
  console.log('\nCurrent AI status for all profiles:');
  profiles.forEach(p => {
    const status = p.ai_enabled === 1 ? '✅ ENABLED' : '❌ DISABLED';
    console.log(`  ${p.name} (${p.type}): ${status}`);
  });

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

db.close();
console.log('\nDone!');
