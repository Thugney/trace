const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('Enabling all features for all profiles...');

const profiles = db.prepare('SELECT id, name, type FROM profiles').all();
const features = ['books', 'shopping', 'diet', 'ai', 'quizzes', 'tasks', 'regular_school', 'school'];

let count = 0;
profiles.forEach(p => {
  features.forEach(f => {
    db.prepare('INSERT OR REPLACE INTO profile_features (profile_id, feature_key, enabled) VALUES (?, ?, 1)').run(p.id, f);
    count++;
  });
  console.log(`Enabled ${features.length} features for ${p.name} (${p.type})`);
});

console.log(`\nDone! Enabled ${count} feature entries.`);
db.close();
