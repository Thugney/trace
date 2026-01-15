#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Pattern to match relative imports: from './something' or from '../something'
  // Exclude those already ending with .js, .ts, .json, etc.
  const importRegex = /from\s+['"](\.\.?\/[^'"]*?)['"]/g;

  let modified = false;
  const newContent = content.replace(importRegex, (match, importPath) => {
    // Skip if already has extension .js, .ts, .json, etc.
    if (/\.(js|ts|json|node)$/.test(importPath)) {
      return match;
    }

    // Check if this is a directory import (has no extension and might be a package)
    // Simple heuristic: if the path exists as a file with .ts extension locally, add .js
    const fullPath = path.resolve(path.dirname(filePath), importPath);
    const tsFile = fullPath + '.ts';
    const jsFile = fullPath + '.js';

    // Only add .js if the corresponding .ts file exists in src
    if (fs.existsSync(tsFile) || fs.existsSync(jsFile)) {
      modified = true;
      return `from '${importPath}.js'`;
    }

    return match;
  });

  if (modified) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${path.relative(__dirname, filePath)}`);
  }
}

async function main() {
  const srcDir = path.join(__dirname, 'src');

  // Find all .ts files
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
        files.push(fullPath);
      }
    }
  }

  walk(srcDir);

  console.log(`Processing ${files.length} TypeScript files...`);

  for (const file of files) {
    await processFile(file);
  }

  console.log('Done!');
}

main().catch(console.error);