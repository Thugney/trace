import { db } from '../database/init';

console.log('=== DATABASE DIAGNOSTIC ===\n');

// Check all profiles
console.log('📋 ALL PROFILES:');
const profiles: any[] = db.prepare('SELECT id, name, type, parent_id, ai_enabled FROM profiles').all();
profiles.forEach(p => {
  console.log(`  ID: ${p.id} | Name: ${p.name} | Type: ${p.type} | Parent: ${p.parent_id || 'none'} | AI: ${p.ai_enabled || 0}`);
});

// Check parent-child relationships
console.log('\n👨‍👩‍👧‍👦 PARENT-CHILD RELATIONSHIPS:');
const parents = profiles.filter(p => p.type === 'parent' || p.type === 'admin');
parents.forEach(parent => {
  const children = profiles.filter(p => p.parent_id === parent.id);
  console.log(`  ${parent.name} (ID: ${parent.id}) has ${children.length} children:`);
  children.forEach(child => {
    console.log(`    - ${child.name} (ID: ${child.id}) | AI: ${child.ai_enabled === 1 ? 'ENABLED' : 'DISABLED'}`);
  });
});

// Check children without parents
console.log('\n⚠️  ORPHANED CHILDREN (no parent_id):');
const orphans = profiles.filter(p => p.type === 'child' && !p.parent_id);
orphans.forEach(orphan => {
  console.log(`  - ${orphan.name} (ID: ${orphan.id})`);
});

// Check database mode
console.log('\n🔧 DATABASE SETTINGS:');
const journalMode: any = db.pragma('journal_mode', { simple: true });
const busyTimeout: any = db.pragma('busy_timeout', { simple: true });
console.log(`  Journal Mode: ${journalMode}`);
console.log(`  Busy Timeout: ${busyTimeout}ms`);

console.log('\n=== END DIAGNOSTIC ===');
