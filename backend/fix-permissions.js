/**
 * Database Fix Script: Family Type Permissions
 *
 * This script ensures:
 * 1. families table has family_type column
 * 2. module_permissions table exists
 * 3. All profiles have correct permissions based on their family type
 *
 * Run with: cat backend/fix-permissions.js | docker-compose exec -T backend node
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || '/app/data/family-hub.db';
console.log('Opening database at:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Helper to check if column exists
function columnExists(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some(col => col.name === column);
}

// Helper to check if table exists
function tableExists(table) {
  const result = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(table);
  return !!result;
}

console.log('\n=== Database Fix Script: Family Type Permissions ===\n');

// Step 1: Check families table
console.log('Step 1: Checking families table...');
if (!tableExists('families')) {
  console.log('ERROR: families table does not exist! Run database initialization first.');
  process.exit(1);
}

// Step 2: Ensure family_type column exists
console.log('Step 2: Checking family_type column...');
if (!columnExists('families', 'family_type')) {
  console.log('Adding family_type column to families table...');
  db.prepare("ALTER TABLE families ADD COLUMN family_type TEXT DEFAULT 'A' CHECK(family_type IN ('A', 'B'))").run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_families_type ON families(family_type)').run();
  console.log('✅ Added family_type column');
} else {
  console.log('✅ family_type column already exists');
}

// Update any NULL family_type values to 'A'
const updateResult = db.prepare("UPDATE families SET family_type = 'A' WHERE family_type IS NULL").run();
if (updateResult.changes > 0) {
  console.log(`Updated ${updateResult.changes} families with NULL family_type to 'A'`);
}

// Step 3: Check current families
console.log('\nStep 3: Current families:');
const families = db.prepare('SELECT id, name, family_type FROM families').all();
families.forEach(f => {
  console.log(`  - Family ${f.id}: "${f.name}" - Type ${f.family_type || 'NULL'}`);
});

// Step 4: Ensure module_permissions table exists
console.log('\nStep 4: Checking module_permissions table...');
if (!tableExists('module_permissions')) {
  console.log('Creating module_permissions table...');
  db.prepare(`
    CREATE TABLE module_permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      profile_id INTEGER NOT NULL,
      module TEXT NOT NULL,
      permission_level TEXT NOT NULL DEFAULT 'full',
      granted_by INTEGER,
      granted_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT,
      FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES profiles(id) ON DELETE SET NULL,
      UNIQUE(profile_id, module)
    )
  `).run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_module_permissions_profile ON module_permissions(profile_id)').run();
  db.prepare('CREATE INDEX IF NOT EXISTS idx_module_permissions_module ON module_permissions(module)').run();
  console.log('✅ Created module_permissions table');
} else {
  console.log('✅ module_permissions table already exists');
}

// Step 5: Get all profiles with their family info
console.log('\nStep 5: Getting all profiles...');
const profiles = db.prepare(`
  SELECT p.id, p.name, p.type, p.family_id, f.name as family_name, f.family_type
  FROM profiles p
  LEFT JOIN families f ON p.family_id = f.id
`).all();

console.log(`Found ${profiles.length} profiles:`);
profiles.forEach(p => {
  console.log(`  - Profile ${p.id}: "${p.name}" (${p.type}) - Family: "${p.family_name || 'none'}" (Type ${p.family_type || 'N/A'})`);
});

// Step 6: Initialize permissions for each profile
console.log('\nStep 6: Initializing permissions for all profiles...');

const insertPermission = db.prepare(`
  INSERT OR REPLACE INTO module_permissions (profile_id, module, permission_level)
  VALUES (?, ?, ?)
`);

const initTransaction = db.transaction((profiles) => {
  for (const profile of profiles) {
    const familyType = profile.family_type || 'A'; // Default to A if no family

    // Determine permissions based on profile type and family type
    // permission_level must be: 'admin', 'parent', 'teacher', 'student', or 'none'
    let coreAppLevel = 'none';
    let churchSchoolLevel = 'none';
    const permLevelByType = {
      admin: 'admin',
      parent: 'parent',
      teacher: 'teacher',
      child: 'student'
    };
    const basePermLevel = permLevelByType[profile.type] || 'none';

    if (profile.type === 'admin') {
      // Admins get full access to everything
      coreAppLevel = 'admin';
      churchSchoolLevel = 'admin';
    } else if (profile.type === 'parent') {
      if (familyType === 'A') {
        coreAppLevel = 'parent';
        churchSchoolLevel = 'parent';
      } else {
        // Type B: Church School only
        coreAppLevel = 'none';
        churchSchoolLevel = 'parent';
      }
    } else if (profile.type === 'child') {
      if (familyType === 'A') {
        coreAppLevel = 'student';
        churchSchoolLevel = 'student';
      } else {
        // Type B: Church School only
        coreAppLevel = 'none';
        churchSchoolLevel = 'student';
      }
    } else if (profile.type === 'teacher') {
      // Teachers only get church school
      coreAppLevel = 'none';
      churchSchoolLevel = 'teacher';
    }

    console.log(`  Setting ${profile.name} (${profile.type}, Family Type ${familyType}): core_app=${coreAppLevel}, church_school=${churchSchoolLevel}`);

    insertPermission.run(profile.id, 'core_app', coreAppLevel);
    insertPermission.run(profile.id, 'church_school', churchSchoolLevel);
  }
});

initTransaction(profiles);
console.log('✅ Permissions initialized for all profiles');

// Step 7: Verify permissions
console.log('\nStep 7: Verifying permissions:');
const permissions = db.prepare(`
  SELECT p.name, p.type, f.family_type, mp.module, mp.permission_level
  FROM profiles p
  LEFT JOIN families f ON p.family_id = f.id
  LEFT JOIN module_permissions mp ON p.id = mp.profile_id
  ORDER BY p.id, mp.module
`).all();

let currentProfile = null;
permissions.forEach(perm => {
  if (currentProfile !== perm.name) {
    currentProfile = perm.name;
    console.log(`\n  ${perm.name} (${perm.type}, Family Type ${perm.family_type || 'N/A'}):`);
  }
  if (perm.module) {
    console.log(`    - ${perm.module}: ${perm.permission_level}`);
  }
});

console.log('\n=== Fix Script Complete ===\n');
console.log('Please rebuild Docker and test that:');
console.log('1. Family Type A users have full app access');
console.log('2. Family Type B users only see Church School features');

db.close();
