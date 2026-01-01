// Simple PIN reset script - run with: node reset-pins.js
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './data/family.db';

console.log('🔧 PIN Reset Script');
console.log('📊 Database:', DB_PATH);

const db = new Database(DB_PATH);

try {
  // Get all profiles with PINs
  const profiles = db.prepare('SELECT id, name, pin FROM profiles WHERE pin IS NOT NULL').all();

  console.log(`\n📋 Found ${profiles.length} profiles with PINs`);

  let hashedCount = 0;

  // Check each PIN and reset if it's bcrypt hashed
  for (const profile of profiles) {
    if (profile.pin && (profile.pin.startsWith('$2b$') || profile.pin.startsWith('$2a$'))) {
      console.log(`\n🔐 Found bcrypt-hashed PIN for ${profile.name} (ID: ${profile.id})`);
      console.log(`   Old PIN: ${profile.pin.substring(0, 20)}...`);

      // Reset to a simple default PIN: 1234
      const newPin = '1234';

      db.prepare('UPDATE profiles SET pin = ? WHERE id = ?').run(newPin, profile.id);

      console.log(`   ✅ Reset PIN to: ${newPin}`);

      hashedCount++;
    } else {
      console.log(`✓ ${profile.name}: PIN is already plain text (${profile.pin})`);
    }
  }

  console.log(`\n✅ Reset complete!`);
  console.log(`   - Total profiles: ${profiles.length}`);
  console.log(`   - Hashed PINs reset: ${hashedCount}`);
  console.log(`   - Already plain: ${profiles.length - hashedCount}`);

  if (hashedCount > 0) {
    console.log(`\n⚠️  IMPORTANT: All reset PINs are now "1234"`);
    console.log(`   Users should change their PINs after logging in!`);
  }

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
} finally {
  db.close();
}
