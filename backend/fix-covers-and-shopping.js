const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

console.log('=== Checking book covers ===');
const books = db.prepare('SELECT id, title, cover_image FROM books').all();
books.forEach(book => {
  console.log(`Book ${book.id}: "${book.title}"`);
  console.log(`  cover_image: ${book.cover_image || 'NULL'}`);
});

console.log('\n=== Checking profile_features for shopping ===');
const shopFeatures = db.prepare("SELECT pf.*, p.name FROM profile_features pf JOIN profiles p ON pf.profile_id = p.id WHERE feature_key = 'shopping'").all();
shopFeatures.forEach(f => {
  console.log(`Profile ${f.profile_id} (${f.name}): shopping enabled = ${f.enabled}`);
});

console.log('\n=== Enabling shopping for all profiles ===');
const profiles = db.prepare('SELECT id, name, type FROM profiles').all();
profiles.forEach(p => {
  db.prepare('INSERT OR REPLACE INTO profile_features (profile_id, feature_key, enabled) VALUES (?, ?, 1)').run(p.id, 'shopping');
  console.log(`Enabled shopping for ${p.name} (${p.type})`);
});

console.log('\n=== Done ===');
db.close();
