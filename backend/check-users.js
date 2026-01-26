const Database = require('better-sqlite3');
const db = new Database('/app/data/family.db');

const users = db.prepare(`SELECT id, name, type, username, pin, password FROM profiles WHERE username IN ('sarah', 'sara', 'ami') OR name IN ('Sarah', 'Sara', 'Ami')`).all();

users.forEach(u => {
  console.log(`${u.name} (${u.username}): PIN=${u.pin ? 'SET' : 'NULL'}, Password=${u.password ? 'SET' : 'NULL'}`);
  if (u.pin) console.log('  PIN hash:', u.pin.substring(0,30) + '...');
  if (u.password) console.log('  Password hash:', u.password.substring(0,30) + '...');
});
db.close();
