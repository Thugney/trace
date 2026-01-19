const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('=== Enabling ALL features for ALL profiles ===\n');

// ALL features from feature-keys.ts that are used by routes
const ALL_FEATURES = [
  'school',           // Church School
  'regular_school',   // Regular School homework tracking
  'shopping',         // Shopping Gamification
  'books',            // AI Book Creator
  'tasks',            // Tasks
  'diet',             // Diet tracking
  'ai',               // AI features
  'notes',            // Notes
  'rewards',          // Rewards
  'calendar',         // Calendar
  'quizzes',          // Quizzes
  'goals',            // Goals
  'gamification',     // Gamification
  'leaderboard',      // Leaderboard
  'journey',          // Learning journey
  'reminders'         // Reminders
];

const profiles = db.prepare('SELECT id, name, type FROM profiles').all();

console.log(`Found ${profiles.length} profiles`);
console.log(`Enabling ${ALL_FEATURES.length} features each\n`);

let count = 0;
profiles.forEach(p => {
  ALL_FEATURES.forEach(f => {
    db.prepare('INSERT OR REPLACE INTO profile_features (profile_id, feature_key, enabled) VALUES (?, ?, 1)').run(p.id, f);
    count++;
  });
  console.log(`✓ ${p.name} (${p.type}) - ${ALL_FEATURES.length} features enabled`);
});

console.log(`\n=== Done! ===`);
console.log(`Total: ${count} feature entries enabled`);
console.log(`\nFeatures enabled: ${ALL_FEATURES.join(', ')}`);
db.close();
