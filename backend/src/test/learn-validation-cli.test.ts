import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';
import { DEFAULT_CONTENT_DIR, loadContentPackage, PACKAGE_FILES, validateContentPackage } from '../services/learn/contentPackage.js';
import { GRADE8_PILOT } from '../services/learn/curriculum.js';

const backend = path.resolve(__dirname, '../..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'learn-validation-cli-'));
const sandbox = path.join(temporary, 'backend');
const source = path.resolve(DEFAULT_CONTENT_DIR);
const defaultDatabase = path.join(sandbox, 'data', 'family.db');
const tsx = path.join(backend, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const pilotTopics = GRADE8_PILOT.map(subject => ({ subject: subject.slug, slug: subject.topic.slug }));

beforeAll(() => {
  // Run the real CLI and its unchanged relative imports in a disposable tree.
  // Even the pre-fix default database path then stays outside the checkout.
  fs.cpSync(path.join(backend, 'src'), path.join(sandbox, 'src'), { recursive: true });
});
afterAll(() => fs.rmSync(temporary, { recursive: true, force: true }));

function run(options: { database?: string; source?: string; args?: string[]; json?: boolean } = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, NODE_PATH: path.join(backend, 'node_modules'), TZ: 'Europe/Oslo' };
  delete env.DATABASE_PATH;
  if (options.database !== undefined) env.DATABASE_PATH = options.database;
  return spawnSync(process.execPath, [tsx, path.join(sandbox, 'src/scripts/import-learn-content.ts'),
    ...(options.args ?? ['--validate-only']), '--source', options.source ?? source, ...(options.json === false ? [] : ['--json'])],
  { cwd: sandbox, env, encoding: 'utf8', timeout: 30000, maxBuffer: 4 * 1024 * 1024 });
}
function expectedReport(contentSource = source) {
  const pkg = loadContentPackage(contentSource);
  return { source: contentSource, source_hash: pkg.sourceHash, ...validateContentPackage(pkg, { existingGrade8PilotTopics: pilotTopics }) };
}
function noDatabase(database: string) {
  for (const suffix of ['', '-wal', '-shm', '-journal']) expect(fs.existsSync(database + suffix)).toBe(false);
}
function parseReport(stdout: string) {
  // --write logs migrations before the unchanged JSON report.
  const start = stdout.indexOf('{\n  "source"');
  return JSON.parse(stdout.slice(start));
}

describe('Learn validate-only CLI database isolation', () => {
  it('does not initialize a default database when DATABASE_PATH is absent, preserving exact JSON output', () => {
    const result = run();
    expect(result.error).toBeUndefined();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expectedReport());
    noDatabase(defaultDatabase);
    expect(fs.existsSync(path.dirname(defaultDatabase))).toBe(false);
  });

  it('does not create the configured missing database or its directory', () => {
    const database = path.join(temporary, 'missing', 'nested', 'family.db');
    const result = run({ database });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expectedReport());
    noDatabase(database);
    expect(fs.existsSync(path.dirname(database))).toBe(false);
  });

  it('does not touch an existing sentinel SQLite database or create WAL/SHM/journal files', () => {
    const database = path.join(temporary, 'sentinel.db');
    const sentinel = new Database(database);
    sentinel.exec("CREATE TABLE sentinel (value TEXT); INSERT INTO sentinel VALUES ('untouched test data')");
    sentinel.close();
    const bytes = fs.readFileSync(database);
    const result = run({ database });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expectedReport());
    expect(fs.readFileSync(database)).toEqual(bytes);
    for (const suffix of ['-wal', '-shm', '-journal']) expect(fs.existsSync(database + suffix)).toBe(false);
  });

  it('succeeds with a database path that cannot be opened as SQLite', () => {
    const database = path.join(temporary, 'database-is-a-directory');
    fs.mkdirSync(database);
    const result = run({ database });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual(expectedReport());
    expect(fs.readdirSync(database)).toEqual([]);
  });

  it('returns the same validation errors and nonzero exit for invalid content without opening a database', () => {
    const invalidSource = path.join(temporary, 'invalid-content');
    fs.cpSync(source, invalidSource, { recursive: true });
    const file = path.join(invalidSource, PACKAGE_FILES.subject('matematikk'));
    const subject = JSON.parse(fs.readFileSync(file, 'utf8'));
    subject.lessons[0].grade = 99;
    fs.writeFileSync(file, JSON.stringify(subject));
    const database = path.join(temporary, 'invalid-content.db');
    const result = run({ database, source: invalidSource });
    expect(result.status).toBe(1);
    expect(JSON.parse(result.stdout)).toEqual(expectedReport(invalidSource));
    expect(JSON.parse(result.stdout).errors.length).toBeGreaterThan(0);
    noDatabase(database);
  });

  it('preserves human-readable validation output without a usable database path', () => {
    const database = path.join(temporary, 'text-output-directory');
    fs.mkdirSync(database);
    const result = run({ database, json: false });
    const report = expectedReport();
    expect(result.status).toBe(0);
    const expected = [`Source: ${source}`, 'Validation: passed', `Stats: ${JSON.stringify(report.stats)}`,
      ...report.errors.map(error => `  ERROR ${error}`), ...report.warnings.map(warning => `  WARN  ${warning}`), ''].join('\n');
    expect(result.stdout.replace(/\r\n/g, '\n')).toBe(expected);
  });

  it('still refuses rehearsal against a missing database without creating one', () => {
    const database = path.join(temporary, 'missing-rehearsal.db');
    const result = run({ database, args: [] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('A rehearsal runs against an already initialized restored copy');
    noDatabase(database);
  });

  it('preserves actual --write and rehearsal behavior against a disposable database', () => {
    const database = path.join(temporary, 'write-and-rehearse.db');
    const write = run({ database, args: ['--write'] });
    expect(write.status).toBe(0);
    expect(parseReport(write.stdout)).toMatchObject({ database, ok: true, validation: { ok: true, stats: expectedReport().stats }, summary: { dry_run: false } });
    const inspect = () => {
      const db = new Database(database, { readonly: true });
      try {
        return {
          lessons: db.prepare('SELECT * FROM learn_lessons ORDER BY id').all(),
          papers: db.prepare('SELECT * FROM learn_review_papers ORDER BY id').all(),
          audit: (db.prepare('SELECT COUNT(*) AS n FROM learn_content_imports').get() as { n: number }).n
        };
      } finally { db.close(); }
    };
    const before = inspect();
    const written = new Database(database, { readonly: true });
    try {
      expect(written.prepare('SELECT source_hash FROM learn_content_imports ORDER BY id DESC LIMIT 1').get()).toEqual({ source_hash: expectedReport().source_hash });
    } finally { written.close(); }
    const rehearsal = run({ database, args: [] });
    expect(rehearsal.status).toBe(0);
    expect(parseReport(rehearsal.stdout)).toMatchObject({ database, ok: true, summary: { dry_run: true } });
    const after = inspect();
    expect(after.lessons).toEqual(before.lessons);
    expect(after.papers).toEqual(before.papers);
    expect(after.audit).toBe(before.audit + 1);
  }, 30000);
});
