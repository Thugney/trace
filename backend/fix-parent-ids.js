// Quick script to link existing children to their parents
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'data/family.db');
const db = new Database(DB_PATH);

console.log('📋 Current profiles:');
const profiles = db.prepare('SELECT id, name, type, parent_id FROM profiles ORDER BY type, id').all();
profiles.forEach(p => {
  console.log(`  ID: ${p.id}, Name: ${p.name}, Type: ${p.type}, Parent ID: ${p.parent_id || 'NULL'}`);
});

console.log('\n🔧 Linking children to parents...');

// Get all parents
const parents = db.prepare('SELECT id, name FROM profiles WHERE type = ?').all('parent');

// For each parent, find children with similar names or ask user
parents.forEach(parent => {
  console.log(`\n👨‍👩‍👧 Parent: ${parent.name} (ID: ${parent.id})`);

  // Get all children without parent_id
  const orphanChildren = db.prepare('SELECT id, name FROM profiles WHERE type = ? AND parent_id IS NULL').all('child');

  orphanChildren.forEach(child => {
    // Auto-link if we can infer (in your case, just link all orphan children to first parent)
    console.log(`  ↳ Linking child: ${child.name} (ID: ${child.id})`);
    db.prepare('UPDATE profiles SET parent_id = ? WHERE id = ?').run(parent.id, child.id);
  });
});

console.log('\n✅ Updated profiles:');
const updatedProfiles = db.prepare('SELECT id, name, type, parent_id FROM profiles ORDER BY type, id').all();
updatedProfiles.forEach(p => {
  console.log(`  ID: ${p.id}, Name: ${p.name}, Type: ${p.type}, Parent ID: ${p.parent_id || 'NULL'}`);
});

db.close();
console.log('\n✅ Done! Refresh the enrollment page.');
