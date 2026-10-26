import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import http from 'http';
import type { AddressInfo } from 'net';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { testDb } from './setup.js';
import { createTestProfile, authHeaders } from './helpers.js';

// Disposable H5P data root for this file only; the mocked service below points
// H5P_PATHS here so the route's multer storage never touches real data.
const H5P_TEST_DIR = path.join(os.tmpdir(), `familyhub-h5p-upload-security-${process.pid}`);
const UPLOAD_DIR = path.join(H5P_TEST_DIR, 'uploads');

vi.mock('../services/h5pService', async () => {
  const nodeOs = await import('os');
  const nodePath = await import('path');
  const nodeFs = await import('fs');
  const data = nodePath.join(nodeOs.tmpdir(), `familyhub-h5p-upload-security-${process.pid}`);
  nodeFs.mkdirSync(data, { recursive: true });
  return {
    H5P_PATHS: {
      data,
      libraries: nodePath.join(data, 'libraries'),
      content: nodePath.join(data, 'content'),
      temp: nodePath.join(data, 'temp'),
      core: nodePath.join(data, 'core'),
      editor: nodePath.join(data, 'editor'),
      downloads: nodePath.join(data, 'downloads'),
      cardImages: nodePath.join(data, 'card-images')
    },
    initializeH5P: vi.fn(async () => {}),
    createH5PUser: vi.fn((id: number, name: string) => ({ id: String(id), name })),
    installLibraryFromFile: vi.fn(),
    importH5PContent: vi.fn(),
    getInstalledContentTypes: vi.fn(async () => ['H5P.QuestionSet 1.20']),
    getH5PEditor: vi.fn(),
    getH5PPlayer: vi.fn(),
    createH5PContent: vi.fn(),
    updateH5PContent: vi.fn(),
    getH5PContentForPlay: vi.fn(),
    deleteH5PContent: vi.fn(),
    convertQuizSpecToH5P: vi.fn(),
    extractQuizSpecFromAiPrompt: vi.fn(),
    questionSetNeedsRepair: vi.fn(),
    validateQuizSpec: vi.fn(),
    installLibraryFromHub: vi.fn(),
    getAvailableContentTypes: vi.fn(),
    checkRequiredLibraries: vi.fn(),
    getRunnableContentTypes: vi.fn(),
    convertMemoryGameToH5P: vi.fn(),
    convertFlashcardsToH5P: vi.fn(),
    convertFindTheWordsToH5P: vi.fn(),
    convertDialogCardsToH5P: vi.fn(),
    copyCardImagesToH5PContent: vi.fn()
  };
});

import h5pRouter from '../routes/h5p.js';
import {
  initializeH5P,
  installLibraryFromFile,
  importH5PContent
} from '../services/h5pService.js';

const initMock = vi.mocked(initializeH5P);
const installMock = vi.mocked(installLibraryFromFile);
const importMock = vi.mocked(importH5PContent);

const UPLOAD_ROUTES = [
  { url: '/api/h5p/libraries/upload', service: installMock },
  { url: '/api/h5p/content/import', service: importMock }
] as const;

const PACKAGE_BYTES = Buffer.from('PK\u0003\u0004 fake h5p package bytes');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/h5p', h5pRouter);
  return app;
}

function uploadedFiles(): string[] {
  return fs.existsSync(UPLOAD_DIR) ? fs.readdirSync(UPLOAD_DIR) : [];
}

// Cleanup runs as the response completes, which can race the client reading it
async function waitFor(check: () => boolean, timeoutMs = 2000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  return check();
}

async function expectNoTempUploads() {
  expect(await waitFor(() => uploadedFiles().length === 0)).toBe(true);
  expect(uploadedFiles()).toEqual([]);
}

function setSetting(key: string, value: string) {
  testDb.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

function createFamily() {
  const parent = createTestProfile({ name: 'Parent', type: 'parent' });
  const child = createTestProfile({ name: 'Kid', type: 'child', parent_id: parent.id });
  const admin = createTestProfile({ name: 'Admin', type: 'admin' });
  return { parent, child, admin };
}

beforeAll(() => {
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS h5p_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      h5p_content_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content_type TEXT,
      library_name TEXT,
      created_by INTEGER NOT NULL,
      metadata TEXT,
      is_ai_generated INTEGER DEFAULT 0,
      ai_prompt TEXT,
      ai_provider TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

beforeEach(() => {
  vi.clearAllMocks();
  initMock.mockResolvedValue(undefined);
  installMock.mockResolvedValue({ installed: ['H5P.QuestionSet 1.20'], errors: [] });
  importMock.mockResolvedValue({
    contentId: '77',
    metadata: {
      title: 'Imported quiz',
      mainLibrary: 'H5P.QuestionSet',
      preloadedDependencies: [{ machineName: 'H5P.QuestionSet', majorVersion: 1, minorVersion: 20 }]
    },
    installedLibraries: ['H5P.QuestionSet 1.20'],
    errors: []
  } as any);
});

afterEach(() => {
  testDb.exec('DELETE FROM h5p_content');
  for (const name of uploadedFiles()) {
    fs.rmSync(path.join(UPLOAD_DIR, name), { force: true });
  }
});

afterAll(() => {
  fs.rmSync(H5P_TEST_DIR, { recursive: true, force: true });
});

// Must run first: the route memoises a successful H5P initialization per process
describe('H5P upload initialization failure', () => {
  it.each(UPLOAD_ROUTES)('removes the temp upload when H5P cannot initialize ($url)', async ({ url, service }) => {
    const { parent } = createFamily();
    initMock.mockRejectedValueOnce(new Error('H5P core missing'));

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(500);
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });
});

describe('H5P upload authorization (SEC-001)', () => {
  it.each(UPLOAD_ROUTES)('rejects an unauthenticated upload before parsing ($url)', async ({ url, service }) => {
    const res = await request(createApp())
      .post(url)
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(401);
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects a child with 403 without writing the file or initializing H5P ($url)', async ({ url, service }) => {
    const { child } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(child.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only parents\/admins/);
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    // Nothing was left behind, and nothing needed cleaning: see the malformed-body case below
    expect(uploadedFiles()).toEqual([]);
  });

  it.each(UPLOAD_ROUTES)('rejects a child before the multipart parser runs ($url)', async ({ url }) => {
    const { child } = createFamily();

    // A body the multipart parser would reject; a 403 proves it never ran
    const res = await request(createApp())
      .post(url)
      .set(authHeaders(child.id))
      .set('Content-Type', 'multipart/form-data; boundary=----not-really-there')
      .send('this is not a multipart body');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/Only parents\/admins/);
    expect(initMock).not.toHaveBeenCalled();
    expect(uploadedFiles()).toEqual([]);
  });

  it.each(UPLOAD_ROUTES)('keeps the activities feature gate for parents ($url)', async ({ url, service }) => {
    const { parent } = createFamily();
    // Activities is outside the default school-only allowlist
    setSetting('school_only_mode', 'true');

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/school-only mode/);
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    expect(uploadedFiles()).toEqual([]);
  });
});

describe('H5P upload for parents and admins (SEC-002)', () => {
  it('installs a parent library upload from the real temp file, then removes it', async () => {
    const { parent } = createFamily();
    let seenPath = '';
    let seenBytes: Buffer | null = null;
    installMock.mockImplementationOnce(async (filePath: string) => {
      seenPath = filePath;
      seenBytes = fs.readFileSync(filePath);
      return { installed: ['H5P.QuestionSet 1.20'], errors: [] };
    });

    const res = await request(createApp())
      .post('/api/h5p/libraries/upload')
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, contentTypesCount: 1 });
    expect(path.dirname(seenPath)).toBe(UPLOAD_DIR);
    expect(seenBytes).toEqual(PACKAGE_BYTES);
    expect(installMock.mock.calls[0][1]).toMatchObject({ id: String(parent.id) });
    await expectNoTempUploads();
  });

  it('imports admin content, records it, then removes the temp file', async () => {
    const { admin } = createFamily();
    let seenBytes: Buffer | null = null;
    importMock.mockImplementationOnce(async (filePath: string) => {
      seenBytes = fs.readFileSync(filePath);
      return {
        contentId: '77',
        metadata: {
          title: 'Imported quiz',
          mainLibrary: 'H5P.QuestionSet',
          preloadedDependencies: [{ machineName: 'H5P.QuestionSet', majorVersion: 1, minorVersion: 20 }]
        },
        installedLibraries: ['H5P.QuestionSet 1.20'],
        errors: []
      } as any;
    });

    const res = await request(createApp())
      .post('/api/h5p/content/import')
      .set(authHeaders(admin.id))
      .attach('h5pFile', PACKAGE_BYTES, 'quiz.h5p');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, h5pContentId: '77', title: 'Imported quiz' });
    expect(seenBytes).toEqual(PACKAGE_BYTES);
    const row = testDb.prepare('SELECT * FROM h5p_content WHERE id = ?').get(res.body.contentId) as any;
    expect(row).toMatchObject({
      h5p_content_id: '77',
      created_by: admin.id,
      content_type: 'QuestionSet',
      library_name: 'H5P.QuestionSet 1.20'
    });
    await expectNoTempUploads();
  });

  it('removes the temp file when library installation throws', async () => {
    const { parent } = createFamily();
    installMock.mockRejectedValueOnce(new Error('invalid package'));

    const res = await request(createApp())
      .post('/api/h5p/libraries/upload')
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(500);
    await expectNoTempUploads();
  });

  it('removes the temp file when content import reports errors', async () => {
    const { parent } = createFamily();
    importMock.mockResolvedValueOnce({ contentId: null, metadata: null, installedLibraries: [], errors: ['bad zip'] } as any);

    const res = await request(createApp())
      .post('/api/h5p/content/import')
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(500);
    expect(res.body.details).toBe('bad zip');
    expect(testDb.prepare('SELECT COUNT(*) AS n FROM h5p_content').get()).toEqual({ n: 0 });
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects a request without a file before initializing H5P ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp()).post(url).set(authHeaders(parent.id)).send({});

    expect(res.status).toBe(400);
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
  });
});

describe('H5P upload multipart bounds (SEC-002)', () => {
  it.each(UPLOAD_ROUTES)('rejects extra form fields and leaves no temp file ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .field('note', 'not part of the client contract')
      .attach('h5pFile', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects more than one file and leaves no temp file ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .attach('h5pFile', PACKAGE_BYTES, 'one.h5p')
      .attach('h5pFile', PACKAGE_BYTES, 'two.h5p');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects an unexpected file field ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .attach('somethingElse', PACKAGE_BYTES, 'package.h5p');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects a non-H5P file with a JSON 400 ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .attach('h5pFile', Buffer.from('hello'), { filename: 'notes.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/\.h5p/);
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it.each(UPLOAD_ROUTES)('rejects a malformed multipart body from a parent with a JSON 400 ($url)', async ({ url, service }) => {
    const { parent } = createFamily();

    const res = await request(createApp())
      .post(url)
      .set(authHeaders(parent.id))
      .set('Content-Type', 'multipart/form-data; boundary=----not-really-there')
      .send('this is not a multipart body');

    expect(res.status).toBe(400);
    expect(res.body.error).toEqual(expect.any(String));
    expect(initMock).not.toHaveBeenCalled();
    expect(service).not.toHaveBeenCalled();
    await expectNoTempUploads();
  });

  it('removes a partially written upload and answers 500 when the disk write fails', async () => {
    const { parent } = createFamily();
    // 0x01 bytes can never look like the start of a boundary, so the parser
    // forwards each chunk to the file whole instead of holding a tail back
    const FIRST_CHUNK = Buffer.alloc(8 * 1024, 1);
    const FINAL_CHUNK = Buffer.alloc(8 * 1024, 1);
    const boundary = '----h5p-enospc-test';
    const head = Buffer.from(
      `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="h5pFile"; filename="big.h5p"\r\n' +
      'Content-Type: application/zip\r\n\r\n'
    );
    const tail = Buffer.from(`\r\n--${boundary}--\r\n`);

    // Only temp files in the test upload dir are intercepted; each write, single or
    // vectored, goes through one gate: real disk write until armed, ENOSPC after
    const realCreateWriteStream = fs.createWriteStream;
    const tempPaths: string[] = [];
    let diskFull = false;
    let injectedFailures = 0;
    let bytesOnDisk = 0;
    let firstChunkOnDisk!: () => void;
    const firstChunkWritten = new Promise<void>(resolve => { firstChunkOnDisk = resolve; });
    const enospc = () => Object.assign(new Error('ENOSPC: no space left on device, write'), { code: 'ENOSPC', syscall: 'write' });
    const gate = (bytes: number, write: (done: (err?: Error | null) => void) => void, cb: (err?: Error | null) => void) => {
      if (diskFull) {
        injectedFailures++;
        return cb(enospc());
      }
      write(err => {
        if (!err) {
          bytesOnDisk += bytes;
          if (bytesOnDisk >= FIRST_CHUNK.length) firstChunkOnDisk();
        }
        cb(err);
      });
    };

    const writeSpy = vi.spyOn(fs, 'createWriteStream').mockImplementation(((...args: Parameters<typeof fs.createWriteStream>) => {
      const out = realCreateWriteStream(...args);
      if (path.dirname(path.resolve(String(args[0]))) !== path.resolve(UPLOAD_DIR)) return out;

      tempPaths.push(String(args[0]));
      const realWrite = out._write.bind(out);
      out._write = (chunk, encoding, cb) => gate(chunk.length, done => realWrite(chunk, encoding, done), cb);
      if (out._writev) {
        const realWritev = out._writev.bind(out);
        out._writev = (chunks, cb) => gate(
          chunks.reduce((sum, { chunk }) => sum + chunk.length, 0),
          done => realWritev(chunks, done),
          cb
        );
      }
      return out;
    }) as typeof fs.createWriteStream);

    const server = http.createServer(createApp());
    let req: http.ClientRequest | undefined;

    // Bounded waits so a missing signal fails the test instead of hanging it
    const within = <T>(promise: Promise<T>, label: string, ms = 2000) => {
      let timer: NodeJS.Timeout | undefined;
      return Promise.race([
        promise,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), ms);
        })
      ]).finally(() => clearTimeout(timer));
    };

    try {
      await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
      const { port } = server.address() as AddressInfo;

      const clientReq = http.request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/api/h5p/libraries/upload',
        headers: {
          ...authHeaders(parent.id),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(head.length + FIRST_CHUNK.length + FINAL_CHUNK.length + tail.length)
        }
      });
      req = clientReq;
      // Any transport error (including ECONNRESET) rejects and fails the test
      const response = new Promise<{ status: number; contentType: string; body: string }>((resolve, reject) => {
        clientReq.on('error', reject);
        clientReq.on('response', res => {
          let body = '';
          res.setEncoding('utf8');
          res.on('data', chunk => { body += chunk; });
          res.on('error', reject);
          res.on('end', () => resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers['content-type'] ?? ''),
            body
          }));
        });
      });
      response.catch(() => {}); // awaited below; avoid an unhandled rejection meanwhile

      clientReq.write(Buffer.concat([head, FIRST_CHUNK]));

      // The first chunk is really on disk before the device "fills up"
      await within(firstChunkWritten, 'the first chunk to reach disk');
      expect(tempPaths).toHaveLength(1);
      expect(path.dirname(tempPaths[0])).toBe(UPLOAD_DIR);
      expect(bytesOnDisk).toBe(FIRST_CHUNK.length);
      expect(fs.statSync(tempPaths[0]).size).toBe(FIRST_CHUNK.length);
      expect(injectedFailures).toBe(0);

      diskFull = true;
      clientReq.end(Buffer.concat([FINAL_CHUNK, tail]));

      const res = await within(response, 'the upload response');
      expect(res.status).toBe(500);
      expect(res.contentType).toMatch(/application\/json/);
      expect(JSON.parse(res.body).error).toBe('Failed to store H5P upload');
      expect(injectedFailures).toBeGreaterThan(0);
      expect(bytesOnDisk).toBe(FIRST_CHUNK.length);
      expect(initMock).not.toHaveBeenCalled();
      expect(installMock).not.toHaveBeenCalled();
      await expectNoTempUploads();
    } finally {
      req?.destroy();
      writeSpy.mockRestore();
      server.closeAllConnections?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });

  it('removes a partially written upload when the client aborts', async () => {
    const { parent } = createFamily();
    const server = http.createServer(createApp());
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));

    try {
      const { port } = server.address() as AddressInfo;
      const boundary = '----h5p-abort-test';
      const head = Buffer.from(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="h5pFile"; filename="big.h5p"\r\n' +
        'Content-Type: application/zip\r\n\r\n'
      );
      const req = http.request({
        host: '127.0.0.1',
        port,
        method: 'POST',
        path: '/api/h5p/libraries/upload',
        headers: {
          ...authHeaders(parent.id),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': String(10 * 1024 * 1024)
        }
      });
      req.on('error', () => {});
      req.write(head);
      req.write(Buffer.alloc(256 * 1024, 1));

      // The file is being streamed to disk before the client goes away
      expect(await waitFor(() => uploadedFiles().length > 0)).toBe(true);
      req.destroy();

      await expectNoTempUploads();
      expect(installMock).not.toHaveBeenCalled();
    } finally {
      server.closeAllConnections?.();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
});
