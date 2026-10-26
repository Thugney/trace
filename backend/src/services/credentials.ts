import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import db from '../database/init';
import { isBcryptHash } from './authSessions';

const SALT_ROUNDS = 10;

function timingSafeEqualStrings(a: string, b: string): boolean {
  const aHash = crypto.createHash('sha256').update(a).digest();
  const bHash = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash);
}

/**
 * Verify a PIN/password against a stored value.
 * Stored values should be bcrypt hashes; legacy plaintext values are still
 * accepted once and, when `onRehash` is provided, upgraded to a hash.
 */
export async function verifySecret(
  candidate: string,
  stored: string | null | undefined,
  onRehash?: (hash: string) => void
): Promise<boolean> {
  if (!stored || typeof candidate !== 'string' || candidate.length === 0) {
    return false;
  }

  if (isBcryptHash(stored)) {
    return bcrypt.compare(candidate, stored);
  }

  const matches = timingSafeEqualStrings(candidate, stored);
  if (matches && onRehash) {
    onRehash(await bcrypt.hash(candidate, SALT_ROUNDS));
  }
  return matches;
}

export function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, SALT_ROUNDS);
}

/**
 * One-time, repeat-safe migration: hash any legacy plaintext profile PINs and
 * passwords. Earlier versions of /profiles/:id/set-pin stored PINs unhashed,
 * which also made those PINs unusable for login (bcrypt.compare always failed).
 */
export function migrateLegacyProfileCredentials(): { pins: number; passwords: number } {
  const columns = db.prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string }>;
  const hasPassword = columns.some((col) => col.name === 'password');

  const rows = db.prepare(`
    SELECT id, pin${hasPassword ? ', password' : ''}
    FROM profiles
    WHERE pin IS NOT NULL${hasPassword ? ' OR password IS NOT NULL' : ''}
  `).all() as Array<{ id: number; pin: string | null; password?: string | null }>;

  let pins = 0;
  let passwords = 0;

  const updatePin = db.prepare('UPDATE profiles SET pin = ? WHERE id = ?');
  const updatePassword = hasPassword ? db.prepare('UPDATE profiles SET password = ? WHERE id = ?') : null;

  for (const row of rows) {
    if (row.pin && !isBcryptHash(row.pin)) {
      updatePin.run(bcrypt.hashSync(row.pin, SALT_ROUNDS), row.id);
      pins += 1;
    }
    if (updatePassword && row.password && !isBcryptHash(row.password)) {
      updatePassword.run(bcrypt.hashSync(row.password, SALT_ROUNDS), row.id);
      passwords += 1;
    }
  }

  return { pins, passwords };
}

export function migrateLegacyParentPin(): boolean {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'parent_pin'").get() as { value: string | null } | undefined;
  if (!setting?.value || isBcryptHash(setting.value)) {
    return false;
  }

  db.prepare("UPDATE settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = 'parent_pin'")
    .run(bcrypt.hashSync(setting.value, SALT_ROUNDS));
  return true;
}
