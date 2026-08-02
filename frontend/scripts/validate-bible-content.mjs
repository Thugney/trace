import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const contentPath = path.resolve(scriptDirectory, '../src/content/psalms.ts');
const libraryPath = path.resolve(scriptDirectory, '../src/pages/BibleLibrary.tsx');
const source = fs.readFileSync(contentPath, 'utf8');
const librarySource = fs.readFileSync(libraryPath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020
  }
}).outputText;

const contentModule = { exports: {} };
vm.runInNewContext(compiled, {
  exports: contentModule.exports,
  module: contentModule
});

const { PSALMS } = contentModule.exports;
const unavailablePsalmNumbers = [23, 91, 121, 130, 150];

if (!Array.isArray(PSALMS)) {
  throw new Error('PSALMS must be an array.');
}

if (PSALMS.length !== 1 || PSALMS[0]?.number !== 51) {
  throw new Error('The initial Bible release must render Psalm 51 only.');
}

if (unavailablePsalmNumbers.some((number) => PSALMS.some((psalm) => psalm.number === number))) {
  throw new Error('Unavailable placeholder Psalms must not be present.');
}

if (unavailablePsalmNumbers.some((number) => librarySource.includes(`Psalm ${number}`)) || librarySource.includes('Coming next')) {
  throw new Error('BibleLibrary must not render or advertise unavailable placeholder Psalms.');
}

const psalm = PSALMS[0];
if (!psalm.available || psalm.verses.length !== 19) {
  throw new Error('Psalm 51 must be available and contain all 19 verses.');
}

psalm.verses.forEach((verse, index) => {
  const expectedNumber = index + 1;
  if (verse.number !== expectedNumber) {
    throw new Error(`Psalm 51 verse numbering must be sequential; expected ${expectedNumber}.`);
  }

  for (const field of ['scriptText', 'englishText', 'pronunciation']) {
    if (typeof verse[field] !== 'string' || verse[field].trim().length === 0) {
      throw new Error(`Psalm 51:${verse.number} has an empty ${field} layer.`);
    }
  }
});

console.log('Bible content validation passed: Psalm 51 has 19 sequential, complete three-layer verses and 0 placeholder Psalms.');
