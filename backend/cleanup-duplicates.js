// Cleanup duplicate profiles
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data/family.db');
const db = new Database(DB_PATH);

console.log('🗑️  Cleaning up duplicate profiles...\n');

console.log('📋 Current profiles:');
const profiles = db.prepare('SELECT id, name, type, parent_id FROM profiles ORDER BY id').all();
profiles.forEach(p => {
  console.log(`  ID: ${p.id}, Name: ${p.name}, Type: ${p.type}, Parent ID: ${p.parent_id || 'NULL'}`);
});

console.log('\n🔧 Deleting duplicates...');

// Delete duplicate Robel (ID 5) - keeping ID 1
const duplicateRobel = 5;
console.log(`  ✗ Deleting duplicate Robel (ID: ${duplicateRobel})`);
db.prepare('DELETE FROM profiles WHERE id = ?').run(duplicateRobel);

// Delete duplicate Beti (ID 6) - keeping ID 2 which is linked to Robel
const duplicateBeti = 6;
console.log(`  ✗ Deleting duplicate Beti (ID: ${duplicateBeti})`);
db.prepare('DELETE FROM profiles WHERE id = ?').run(duplicateBeti);

console.log('\n✅ Cleaned profiles:');
const cleanedProfiles = db.prepare('SELECT id, name, type, parent_id FROM profiles ORDER BY type DESC, id').all();
cleanedProfiles.forEach(p => {
  console.log(`  ID: ${p.id}, Name: ${p.name}, Type: ${p.type}, Parent ID: ${p.parent_id || 'NULL'}`);
});

db.close();
console.log('\n✅ Done! Refresh the enrollment page.');
console.log('\nYou should now have:');
console.log('  - Robel (parent, ID 1)');
console.log('  - Helen (parent, ID 4)');
console.log('  - Beti (child of Robel, ID 2)');
console.log('  - Bitanya (child of Robel, ID 3)');
