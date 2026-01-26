const Database = require('better-sqlite3');
const path = require('path');

// Try local path first, then Docker path
let dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data/family.db');
const db = new Database(dbPath);

console.log('Using database:', dbPath);
console.log('\n=== Checking Profile Family Assignments ===\n');

const profiles = db.prepare(`
  SELECT p.id, p.name, p.type, p.username, p.family_id, p.parent_id, f.name as family_name, f.family_type
  FROM profiles p
  LEFT JOIN families f ON p.family_id = f.id
`).all();

profiles.forEach(p => {
  console.log(`Profile ${p.id}: "${p.name}" (${p.type}) - username: ${p.username || 'none'}`);
  console.log(`  family_id: ${p.family_id || 'NULL'}`);
  console.log(`  parent_id: ${p.parent_id || 'NULL'}`);
  console.log(`  family_name: ${p.family_name || 'none'}`);
  console.log(`  family_type: ${p.family_type || 'N/A'}`);
  console.log('');
});

console.log('\n=== Checking Module Permissions ===\n');

try {
  const perms = db.prepare(`
    SELECT mp.profile_id, p.name, mp.module, mp.permission_level
    FROM module_permissions mp
    JOIN profiles p ON mp.profile_id = p.id
    ORDER BY mp.profile_id, mp.module
  `).all();

  if (perms.length === 0) {
    console.log('No module_permissions found in database');
  } else {
    perms.forEach(perm => {
      console.log(`${perm.name} (ID ${perm.profile_id}): ${perm.module} = ${perm.permission_level}`);
    });
  }
} catch (e) {
  console.log('module_permissions table may not exist:', e.message);
}

console.log('\n=== All Families ===\n');
const families = db.prepare('SELECT * FROM families').all();
families.forEach(f => {
  console.log(`Family ${f.id}: "${f.name}" - Type: ${f.family_type || 'NOT SET'}, Status: ${f.status}`);
  const members = db.prepare('SELECT id, name, type FROM profiles WHERE family_id = ?').all(f.id);
  console.log(`  Members: ${members.map(m => `${m.name}(${m.type})`).join(', ')}`);
});

console.log('\n=== School Enrollments ===\n');
try {
  const enrollments = db.prepare(`
    SELECT se.*, p.name as student_name, f.name as family_name
    FROM school_enrollments se
    LEFT JOIN profiles p ON se.student_id = p.id
    LEFT JOIN families f ON se.family_id = f.id
  `).all();
  console.log('Enrollments:', enrollments.length > 0 ? enrollments : 'None');
} catch (e) {
  console.log('school_enrollments table may not exist:', e.message);
}

db.close();
