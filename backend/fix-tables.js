const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('Creating tables...');

db.exec(`
  CREATE TABLE IF NOT EXISTS profile_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id INTEGER NOT NULL,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(profile_id, feature_key)
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS family_features (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    parent_id INTEGER NOT NULL,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    UNIQUE(parent_id, feature_key)
  )
`);

console.log('Tables created. Enabling features for all profiles...');

const profiles = db.prepare('SELECT id FROM profiles').all();
const features = ['books', 'shopping', 'diet', 'ai', 'quizzes', 'tasks', 'regular_school'];

profiles.forEach(p => {
  features.forEach(f => {
    db.prepare('INSERT OR REPLACE INTO profile_features (profile_id, feature_key, enabled) VALUES (?, ?, 1)').run(p.id, f);
  });
});

console.log(`Done! Enabled ${features.length} features for ${profiles.length} profiles.`);
db.close();
