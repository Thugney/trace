#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, 'dist');

// Regex to match relative imports without .js extension
// Matches import statements like: import { x } from './module';
// or import x from '../module';
// or import('./module')
// Captures the import specifier without extension
const importRegex = /from\s+['"](\.\.?\/[^'"]*?)['"]|import\s*\(['"](\.\.?\/[^'"]*?)['"]\)/g;

async function processFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  let changed = false;

  const newContent = content.replace(importRegex, (match, fromSpecifier, dynamicSpecifier) => {
    const specifier = fromSpecifier || dynamicSpecifier;
    if (!specifier) return match;

    // Skip if already has .js extension
    if (specifier.endsWith('.js')) return match;
    // Skip if has other extension like .json, .node
    // Check if the filename part (after last /) contains a dot (has extension)
    const lastSlashIndex = specifier.lastIndexOf('/');
    const filename = lastSlashIndex >= 0 ? specifier.substring(lastSlashIndex + 1) : specifier;
    if (filename.includes('.')) return match;

    changed = true;
    const newSpecifier = specifier + '.js';
    if (fromSpecifier) {
      return match.replace(specifier, newSpecifier);
    } else {
      return match.replace(specifier, newSpecifier);
    }
  });

  if (changed) {
    await fs.writeFile(filePath, newContent, 'utf8');
    console.log(`Updated ${path.relative(__dirname, filePath)}`);
  }
}

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      await processFile(fullPath);
    }
  }
}

async function main() {
  console.log('Adding .js extensions to relative imports in dist...');
  await processDirectory(DIST_DIR);
  console.log('Done.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});