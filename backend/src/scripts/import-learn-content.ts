/**
 * Validate and import the FamilyHub Learn Grades 1-10 research package.
 *
 *   npx tsx src/scripts/import-learn-content.ts --validate-only
 *   DATABASE_PATH=/path/to/copy.db npx tsx src/scripts/import-learn-content.ts            (rehearsal)
 *   DATABASE_PATH=/path/to/copy.db npx tsx src/scripts/import-learn-content.ts --write    (import)
 *
 * Options: --source <dir> (default: backend/content/learn), --json (machine-readable output).
 * The import is draft-only and repeat-safe; it is a rehearsal unless --write is given.
 * Use it against a restored copy of production data, never the live database.
 *
 * A rehearsal writes no content: the import runs in a transaction that is rolled
 * back, and the one row it leaves behind is its own audit record in
 * learn_content_imports. It therefore requires a database that already has the
 * schema, and refuses to create or migrate one, because opening a missing file
 * creates it and initialising writes schema and pilot seed rows. Only --write
 * initialises, migrates and seeds.
 */
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

async function main() {
  const { loadContentPackage, validateContentPackage, DEFAULT_CONTENT_DIR } = await import('../services/learn/contentPackage');
  const source = path.resolve(option('--source') || DEFAULT_CONTENT_DIR);
  const pkg = loadContentPackage(source);

  if (flag('--validate-only')) {
    // Validation is data-only: importing contentImport also opens the database.
    const { GRADE8_PILOT } = await import('../services/learn/curriculum');
    const existingGrade8PilotTopics = GRADE8_PILOT.map(subject => ({ subject: subject.slug, slug: subject.topic.slug }));
    const report = validateContentPackage(pkg, { existingGrade8PilotTopics });
    print({ source, source_hash: pkg.sourceHash, ...report });
    process.exit(report.ok ? 0 : 1);
  }

  if (!process.env.DATABASE_PATH) {
    console.error('Set DATABASE_PATH explicitly (use a restored copy, not the live database).');
    process.exit(1);
  }

  const write = flag('--write');
  const databasePath = path.resolve(process.env.DATABASE_PATH);
  // Refuse before the database module loads: opening a missing file creates it
  if (!write && !fs.existsSync(databasePath)) {
    console.error(`No database at ${databasePath}. A rehearsal runs against an already initialized restored copy; it never creates one.`);
    process.exit(1);
  }

  const { db } = await import('../database/init');
  const { importContentPackage } = await import('../services/learn/contentImport');

  if (write) {
    const { initDatabase } = await import('../database/init');
    const { ensureLearnSchema } = await import('../services/learn/schema');
    const { seedLearnCatalog } = await import('../services/learn/catalog');
    initDatabase();
    ensureLearnSchema();
    seedLearnCatalog();
  } else {
    // No initDatabase, ensureLearnSchema or seedLearnCatalog here: each of them
    // writes, and a rehearsal that migrates the target is not a rehearsal
    const required = ['learn_subjects', 'learn_lessons', 'learn_review_papers', 'learn_content_imports'];
    const present = (db.prepare(
      `SELECT COUNT(*) as n FROM sqlite_master WHERE type = 'table' AND name IN (${required.map(() => '?').join(', ')})`
    ).get(...required) as { n: number }).n;
    if (present !== required.length) {
      console.error(`${databasePath} has no FamilyHub Learn schema. Initialize a restored copy with --write first; a rehearsal never migrates.`);
      process.exit(1);
    }
  }

  const result = importContentPackage(pkg, { dryRun: !write });
  print({ source, database: path.resolve(process.env.DATABASE_PATH), ...result });
  process.exit(result.ok ? 0 : 1);
}

function print(value: unknown) {
  if (flag('--json')) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  const report = value as any;
  const validation = report.validation || report;
  console.log(`Source: ${report.source}`);
  if (report.database) console.log(`Database: ${report.database}`);
  console.log(`Validation: ${validation.ok ? 'passed' : 'FAILED'}`);
  console.log('Stats:', JSON.stringify(validation.stats));
  validation.errors.forEach((error: string) => console.log(`  ERROR ${error}`));
  validation.warnings.forEach((warning: string) => console.log(`  WARN  ${warning}`));
  if (report.summary) {
    console.log(`${report.summary.dry_run ? 'Rehearsal (content rolled back, audit row kept)' : 'Imported'}:`, JSON.stringify(report.summary.created));
    console.log('Unchanged:', JSON.stringify(report.summary.unchanged), 'Corrected unused drafts:', JSON.stringify(report.summary.refreshed));
    console.log('Preserved pilot topics:', report.summary.preserved_pilot_topics.length);
    report.summary.skipped.forEach((item: string) => console.log(`  SKIP  ${item}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
