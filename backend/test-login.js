const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const db = new Database('/app/data/family.db');

async function testLogin(username, pin) {
  console.log(`\nTesting login for: ${username} with PIN: ${pin}`);

  const profile = db.prepare(
    'SELECT * FROM profiles WHERE username = ? OR LOWER(name) = LOWER(?)'
  ).get(username, username);

  if (!profile) {
    console.log('  RESULT: Profile not found');
    return;
  }

  console.log(`  Found: ${profile.name} (${profile.type})`);
  console.log(`  Has PIN: ${!!profile.pin}, Has Password: ${!!profile.password}`);

  let isValid = false;

  if (profile.type === 'child') {
    if (!profile.pin) {
      console.log('  RESULT: Child has no PIN set');
      return;
    }
    isValid = await bcrypt.compare(pin, profile.pin);
    console.log(`  PIN comparison result: ${isValid}`);
  } else {
    if (profile.password) {
      isValid = await bcrypt.compare(pin, profile.password);
      console.log(`  Password comparison result: ${isValid}`);
    } else if (profile.pin) {
      isValid = await bcrypt.compare(pin, profile.pin);
      console.log(`  PIN comparison (fallback) result: ${isValid}`);
    } else {
      console.log('  RESULT: No password or PIN set');
      return;
    }
  }

  console.log(`  FINAL RESULT: ${isValid ? 'LOGIN SUCCESS' : 'LOGIN FAILED'}`);
}

(async () => {
  await testLogin('sarah', '1521');
  await testLogin('sara', '1521');
  await testLogin('ami', '1521');
  db.close();
})();
