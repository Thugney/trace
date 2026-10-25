/**
 * Copy the canonical research package (docs/learn) into backend/content/learn,
 * which is what the backend image ships (its Docker context is ./backend).
 *
 *   npx tsx src/scripts/sync-learn-content.ts          copy
 *   npx tsx src/scripts/sync-learn-content.ts --check  exit 1 if the copies differ
 *
 * Files are copied byte-for-byte; nothing is edited.
 */
import fs from 'fs';
import path from 'path';
import { DEFAULT_CONTENT_DIR, packageFileList } from '../services/learn/contentPackage';

const DOCS_DIR = path.resolve(__dirname, '../../../docs/learn');
const check = process.argv.includes('--check');
const differences: string[] = [];

for (const relative of packageFileList()) {
  const from = path.join(DOCS_DIR, relative);
  const to = path.join(DEFAULT_CONTENT_DIR, relative);
  const source = fs.readFileSync(from);
  const same = fs.existsSync(to) && Buffer.compare(source, fs.readFileSync(to)) === 0;
  if (same) continue;
  differences.push(relative);
  if (!check) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, source);
  }
}

if (check) {
  if (differences.length) {
    console.error(`backend/content/learn is out of date: ${differences.join(', ')}. Run without --check to sync.`);
    process.exit(1);
  }
  console.log('backend/content/learn matches docs/learn');
} else {
  console.log(differences.length ? `Synced ${differences.length} file(s): ${differences.join(', ')}` : 'Already in sync');
}
