import crypto from 'crypto';
import db from '../database/init';

/**
 * Server-side authentication sessions.
 *
 * The client receives an opaque random token on login. Only a SHA-256 hash of
 * the token is stored, so a database leak does not leak usable sessions.
 * Request identity is always derived from the session row - never from a
 * client-supplied profile ID.
 *
 * A session records a principal (the profile that proved credentials) and an
 * active profile (the profile acting). Today they are always the same profile
 * because every user signs in directly; the split leaves room for an audited
 * guardian profile switch without another schema change.
 */

export type SessionProfileType = 'admin' | 'parent' | 'child' | 'teacher';

export type SessionProfile = {
  id: number;
  type: SessionProfileType;
  parent_id?: number;
  family_id?: number;
};

export type ResolvedSession = {
  sessionId: number;
  principalId: number;
  principalType: SessionProfileType;
  profile: SessionProfile;
};

const IDLE_TTL_MS = Number(process.env.AUTH_SESSION_IDLE_DAYS || 30) * 24 * 60 * 60 * 1000;
const ABSOLUTE_TTL_MS = Number(process.env.AUTH_SESSION_MAX_DAYS || 90) * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 5 * 60 * 1000;
const STREAM_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const STREAM_TOKEN_PREFIX = 'st1';

let schemaReady = false;

export function ensureAuthSessionSchema() {
  if (schemaReady) {
    return;
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_hash TEXT NOT NULL UNIQUE,
      principal_profile_id INTEGER NOT NULL,
      active_profile_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      idle_expires_at TEXT NOT NULL,
      absolute_expires_at TEXT NOT NULL,
      revoked_at TEXT,
      user_agent TEXT,
      FOREIGN KEY (principal_profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
      FOREIGN KEY (active_profile_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
  `);
  db.exec('CREATE INDEX IF NOT EXISTS idx_auth_sessions_principal ON auth_sessions(principal_profile_id)');

  schemaReady = true;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getSigningSecret(): string {
  if (process.env.AUTH_TOKEN_SECRET) {
    return process.env.AUTH_TOKEN_SECRET;
  }

  // Persist a generated secret so stream tokens survive container restarts.
  const row = db.prepare("SELECT value FROM settings WHERE key = 'auth_token_secret'").get() as { value: string } | undefined;
  if (row?.value) {
    return row.value;
  }

  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare(`
    INSERT INTO settings (key, value) VALUES ('auth_token_secret', ?)
    ON CONFLICT(key) DO NOTHING
  `).run(secret);

  const stored = db.prepare("SELECT value FROM settings WHERE key = 'auth_token_secret'").get() as { value: string };
  return stored.value;
}

function loadProfile(profileId: number): SessionProfile | null {
  const profile = db.prepare('SELECT id, type, parent_id, family_id FROM profiles WHERE id = ?').get(profileId) as any;
  if (!profile) {
    return null;
  }

  return {
    id: profile.id,
    type: profile.type,
    parent_id: profile.parent_id ?? undefined,
    family_id: profile.family_id ?? undefined
  };
}

export function createSession(profileId: number, userAgent?: string): { token: string; sessionId: number; expiresAt: string } {
  ensureAuthSessionSchema();

  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const idleExpiresAt = new Date(now + IDLE_TTL_MS).toISOString();
  const absoluteExpiresAt = new Date(now + ABSOLUTE_TTL_MS).toISOString();

  const result = db.prepare(`
    INSERT INTO auth_sessions (
      token_hash, principal_profile_id, active_profile_id,
      created_at, last_seen_at, idle_expires_at, absolute_expires_at, user_agent
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    hashToken(token),
    profileId,
    profileId,
    nowIso,
    nowIso,
    idleExpiresAt,
    absoluteExpiresAt,
    userAgent ? userAgent.slice(0, 255) : null
  );

  return { token, sessionId: Number(result.lastInsertRowid), expiresAt: idleExpiresAt };
}

function resolveSessionRow(row: any): ResolvedSession | null {
  if (!row || row.revoked_at) {
    return null;
  }

  const now = Date.now();
  if (Date.parse(row.idle_expires_at) <= now || Date.parse(row.absolute_expires_at) <= now) {
    return null;
  }

  const principal = loadProfile(row.principal_profile_id);
  const active = loadProfile(row.active_profile_id);
  if (!principal || !active) {
    return null;
  }

  // Sliding idle expiry, throttled to avoid a write on every request.
  if (now - Date.parse(row.last_seen_at) > TOUCH_INTERVAL_MS) {
    const idleExpiresAt = new Date(Math.min(now + IDLE_TTL_MS, Date.parse(row.absolute_expires_at))).toISOString();
    db.prepare('UPDATE auth_sessions SET last_seen_at = ?, idle_expires_at = ? WHERE id = ?')
      .run(new Date(now).toISOString(), idleExpiresAt, row.id);
  }

  return {
    sessionId: row.id,
    principalId: principal.id,
    principalType: principal.type,
    profile: active
  };
}

export function resolveSessionToken(
  token: string | undefined | null,
  options: { allowStreamToken?: boolean } = {}
): ResolvedSession | null {
  if (!token || typeof token !== 'string' || token.length > 512) {
    return null;
  }

  ensureAuthSessionSchema();

  if (token.startsWith(`${STREAM_TOKEN_PREFIX}.`)) {
    return options.allowStreamToken ? resolveStreamToken(token) : null;
  }

  const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(hashToken(token));
  return resolveSessionRow(row);
}

export function revokeSession(sessionId: number) {
  ensureAuthSessionSchema();
  db.prepare('UPDATE auth_sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), sessionId);
}

export function revokeSessionsForProfile(profileId: number) {
  ensureAuthSessionSchema();
  db.prepare(`
    UPDATE auth_sessions SET revoked_at = ?
    WHERE revoked_at IS NULL AND (principal_profile_id = ? OR active_profile_id = ?)
  `).run(new Date().toISOString(), profileId, profileId);
}

/**
 * Stream tokens are short-lived, HMAC-signed tokens bound to a session and the
 * active profile at issue time. They exist for transports that cannot send an
 * Authorization header (EventSource, H5P iframe asset/AJAX requests), so the
 * long-lived session token never appears in a URL.
 */
export function createStreamToken(session: ResolvedSession): { token: string; expiresAt: string } {
  const expiresAt = Date.now() + STREAM_TOKEN_TTL_MS;
  const payload = `${session.sessionId}.${session.profile.id}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');

  return {
    token: `${STREAM_TOKEN_PREFIX}.${payload}.${signature}`,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

function resolveStreamToken(token: string): ResolvedSession | null {
  const parts = token.split('.');
  if (parts.length !== 5) {
    return null;
  }

  const [, sessionIdRaw, profileIdRaw, expiresAtRaw, signature] = parts;
  const payload = `${sessionIdRaw}.${profileIdRaw}.${expiresAtRaw}`;
  const expected = crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('base64url');

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length || !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)) {
    return null;
  }

  if (Number(expiresAtRaw) <= Date.now()) {
    return null;
  }

  const row = db.prepare('SELECT * FROM auth_sessions WHERE id = ?').get(Number(sessionIdRaw)) as any;
  const session = resolveSessionRow(row);

  // A profile switch invalidates stream tokens issued for the previous profile.
  if (!session || session.profile.id !== Number(profileIdRaw)) {
    return null;
  }

  return session;
}

export function isStreamToken(token: string): boolean {
  return token.startsWith(`${STREAM_TOKEN_PREFIX}.`);
}

export function extractBearerToken(authorizationHeader: string | undefined): string | null {
  if (!authorizationHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1].trim() : null;
}

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$/;

export function isBcryptHash(value: unknown): boolean {
  return typeof value === 'string' && BCRYPT_HASH_PATTERN.test(value);
}
