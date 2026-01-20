/**
 * H5P Library Downloader
 *
 * Downloads essential H5P content type libraries from h5p.org
 * Run with: npx ts-node scripts/download-h5p-libraries.ts
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';

const H5P_DATA_DIR = process.env.H5P_DATA_DIR || path.join(__dirname, '../../data/h5p');
const H5P_DOWNLOADS_DIR = path.join(H5P_DATA_DIR, 'downloads');

// Ensure directories exist
[H5P_DATA_DIR, H5P_DOWNLOADS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Essential H5P content types to download
// These are the reusable example content from h5p.org
const H5P_CONTENT_TYPES = [
  {
    name: 'H5P.QuestionSet',
    description: 'Question Set - combine multiple question types',
    // The download URLs are for example content that includes the library
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/question-set-616.h5p'
  },
  {
    name: 'H5P.MultiChoice',
    description: 'Multiple Choice questions',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/multichoice-702.h5p'
  },
  {
    name: 'H5P.TrueFalse',
    description: 'True/False questions',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/true-false-702.h5p'
  },
  {
    name: 'H5P.Blanks',
    description: 'Fill in the Blanks',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/fill-in-the-blanks-837.h5p'
  },
  {
    name: 'H5P.DragQuestion',
    description: 'Drag and Drop',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/drag-and-drop-702.h5p'
  },
  {
    name: 'H5P.MemoryGame',
    description: 'Memory Game',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/memory-game-702.h5p'
  },
  {
    name: 'H5P.Flashcards',
    description: 'Flashcards for learning',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/flashcards-702.h5p'
  },
  {
    name: 'H5P.ImageHotspots',
    description: 'Image with clickable hotspots',
    exampleUrl: 'https://h5p.org/sites/default/files/h5p/exports/image-hotspots-702.h5p'
  }
];

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const protocol = url.startsWith('https') ? https : http;

    console.log(`Downloading: ${url}`);

    const request = protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          console.log(`  Redirecting to: ${redirectUrl}`);
          file.close();
          fs.unlinkSync(dest);
          downloadFile(redirectUrl, dest).then(resolve).catch(reject);
          return;
        }
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`  Downloaded: ${dest}`);
        resolve();
      });
    });

    request.on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });

    file.on('error', (err) => {
      file.close();
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function downloadAllLibraries() {
  console.log('='.repeat(60));
  console.log('H5P Library Downloader');
  console.log('='.repeat(60));
  console.log(`Download directory: ${H5P_DOWNLOADS_DIR}`);
  console.log('');

  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const contentType of H5P_CONTENT_TYPES) {
    const filename = `${contentType.name.replace('.', '-').toLowerCase()}.h5p`;
    const destPath = path.join(H5P_DOWNLOADS_DIR, filename);

    console.log(`\n[${contentType.name}] ${contentType.description}`);

    // Skip if already downloaded
    if (fs.existsSync(destPath)) {
      console.log(`  Already exists: ${filename}`);
      results.push({ name: contentType.name, success: true });
      continue;
    }

    try {
      await downloadFile(contentType.exampleUrl, destPath);
      results.push({ name: contentType.name, success: true });
    } catch (err: any) {
      console.error(`  Error: ${err.message}`);
      results.push({ name: contentType.name, success: false, error: err.message });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Download Summary');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\nSuccessful: ${successful.length}/${results.length}`);
  successful.forEach(r => console.log(`  ✓ ${r.name}`));

  if (failed.length > 0) {
    console.log(`\nFailed: ${failed.length}`);
    failed.forEach(r => console.log(`  ✗ ${r.name}: ${r.error}`));
  }

  console.log('\n' + '='.repeat(60));
  console.log('Next Steps:');
  console.log('='.repeat(60));
  console.log(`
The .h5p files have been downloaded to: ${H5P_DOWNLOADS_DIR}

To install them, you need to upload each file through the H5P admin interface,
or use the API endpoint: POST /api/h5p/libraries/upload

Note: H5P libraries are bundled with content. When you upload an .h5p file,
the Lumi H5P server will extract and install any missing libraries automatically.
`);
}

// Run the downloader
downloadAllLibraries().catch(console.error);
