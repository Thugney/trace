/**
 * Validate and import the FamilyHub Learn Grades 1-10 research package.
 *
 *   npx tsx src/scripts/import-learn-content.ts --validate-only
 *   DATABASE_PATH=/path/to/copy.db npx tsx src/scripts/import-learn-content.ts            (dry run)
 *   DATABASE_PATH=/path/to/copy.db npx tsx src/scripts/import-learn-content.ts --write    (import)
 *
 * Options: --source <dir> (default: backend/content/learn), --json (machine-readable output).
 * The import is draft-only and repeat-safe; it is a dry run unless --write is given.
 * Use it against a restored copy of production data, never the live database.
 */
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
    const { pilotGrade8Topics } = await import('../services/learn/contentImport');
    const report = validateContentPackage(pkg, { existingGrade8PilotTopics: pilotGrade8Topics() });
    print({ source, source_hash: pkg.sourceHash, ...report });
    process.exit(report.ok ? 0 : 1);
  }

  if (!process.env.DATABASE_PATH) {
    console.error('Set DATABASE_PATH explicitly (use a restored copy, not the live database).');
    process.exit(1);
  }

  const { initDatabase } = await import('../database/init');
  const { ensureLearnSchema } = await import('../services/learn/schema');
  const { seedLearnCatalog } = await import('../services/learn/catalog');
  const { importContentPackage } = await import('../services/learn/contentImport');

  initDatabase();
  ensureLearnSchema();
  seedLearnCatalog();
  const result = importContentPackage(pkg, { dryRun: !flag('--write') });
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
    console.log(`${report.summary.dry_run ? 'Dry run (rolled back)' : 'Imported'}:`, JSON.stringify(report.summary.created));
    console.log('Unchanged:', JSON.stringify(report.summary.unchanged), 'Corrected unused drafts:', JSON.stringify(report.summary.refreshed));
    console.log('Preserved pilot topics:', report.summary.preserved_pilot_topics.length);
    report.summary.skipped.forEach((item: string) => console.log(`  SKIP  ${item}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
