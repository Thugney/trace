/**
 * Local development only: seed a demo family for trying FamilyHub Learn.
 *
 *   DATABASE_PATH=/tmp/learn-demo.db npx tsx src/scripts/seed-learn-demo.ts <credentials-output-file>
 *
 * Refuses to run against the default database path so it can never touch a
 * real family database. Generates random passwords/PIN and writes them only to
 * the given output file.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';

const defaultDbPath = path.resolve(path.join(__dirname, '../../data/family.db'));
const dbPath = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : null;
const outputFile = process.argv[2];

if (!dbPath || dbPath === defaultDbPath || /\/app\/data\//.test(dbPath.replace(/\\/g, '/'))) {
  console.error('Refusing to seed: set DATABASE_PATH to a throwaway database (not the default or /app/data).');
  process.exit(1);
}
if (!outputFile) {
  console.error('Usage: seed-learn-demo.ts <credentials-output-file>');
  process.exit(1);
}

async function main() {
  const { initDatabase, db } = await import('../database/init');
  const { ensureAuthSessionSchema } = await import('../services/authSessions');
  const { ensureLearnSchema } = await import('../services/learn/schema');
  const { seedLearnCatalog } = await import('../services/learn/catalog');

  initDatabase();
  ensureAuthSessionSchema();
  ensureLearnSchema();
  seedLearnCatalog();

  const secret = () => crypto.randomBytes(9).toString('base64url');
  const credentials = {
    admin: { username: 'learn-admin', password: secret() },
    parent: { username: 'learn-parent', password: secret() },
    child: { username: 'learn-kid', pin: String(crypto.randomInt(100000, 999999)) }
  };

  const upsert = (username: string, name: string, type: string, secretValue: string, column: 'password' | 'pin', parentId: number | null, age: number | null) => {
    const existing = db.prepare('SELECT id FROM profiles WHERE username = ?').get(username) as { id: number } | undefined;
    const hash = bcrypt.hashSync(secretValue, 10);
    if (existing) {
      db.prepare(`UPDATE profiles SET ${column} = ? WHERE id = ?`).run(hash, existing.id);
      return existing.id;
    }
    const result = db.prepare(`
      INSERT INTO profiles (name, type, username, ${column}, parent_id, age, ai_enabled, avatar)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run(name, type, username, hash, parentId, age, type === 'child' ? '🦊' : '🙂');
    return Number(result.lastInsertRowid);
  };

  upsert(credentials.admin.username, 'Learn Admin', 'admin', credentials.admin.password, 'password', null, null);
  const parentId = upsert(credentials.parent.username, 'Demo Forelder', 'parent', credentials.parent.password, 'password', null, 42);
  upsert(credentials.child.username, 'Demo Elev', 'child', credentials.child.pin, 'pin', parentId, 13);

  fs.writeFileSync(outputFile, JSON.stringify(credentials, null, 2));
  console.log(`Demo family seeded in ${dbPath}; credentials written to ${outputFile}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
