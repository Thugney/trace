import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h5pRequire = createRequire(require.resolve('@lumieducation/h5p-server/package.json'));
const adapterPath = h5pRequire.resolve('image-size');
const sizeOf = h5pRequire('image-size') as (input: Buffer | string) => { width: number; height: number; type: string };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1EAAAAASUVORK5CYII=', 'base64');
let directory: string;

beforeEach(() => { directory = fs.mkdtempSync(path.join(os.tmpdir(), 'familyhub-image-compat-')); });
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(directory, { recursive: true, force: true });
});

describe('H5P resolves the patched image parser through its synchronous compatibility adapter', () => {
  it('preserves buffer and temporary-file image dimensions', () => {
    const filename = path.join(directory, 'synthetic.png');
    fs.writeFileSync(filename, png);
    expect(sizeOf(png)).toMatchObject({ width: 1, height: 1, type: 'png' });
    expect(sizeOf(filename)).toEqual(sizeOf(png));
  });

  it('bounds file-header reads to the legacy 512 KiB and closes the descriptor', () => {
    const filename = path.join(directory, 'large.png');
    fs.writeFileSync(filename, Buffer.concat([png, Buffer.alloc(1024 * 1024)]));
    const read = vi.spyOn(fs, 'readSync');
    const close = vi.spyOn(fs, 'closeSync');
    expect(sizeOf(filename)).toMatchObject({ width: 1, height: 1 });
    expect(read).toHaveBeenCalled();
    expect(read.mock.calls[0][1].byteLength).toBe(512 * 1024);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('closes the file descriptor when parsing fails', () => {
    const filename = path.join(directory, 'malformed.png');
    fs.writeFileSync(filename, 'not an image');
    const close = vi.spyOn(fs, 'closeSync');
    expect(() => sizeOf(filename)).toThrow();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('rejects empty files and unsupported input types', () => {
    const filename = path.join(directory, 'empty.png');
    fs.writeFileSync(filename, '');
    expect(() => sizeOf(filename)).toThrow('non-empty');
    expect(() => sizeOf('')).toThrow();
    expect(() => sizeOf(null as unknown as Buffer)).toThrow();
  });

  it('rejects a non-advancing ICNS block within a bounded worker lifetime', async () => {
    const input = Buffer.alloc(16);
    input.write('icns');
    input.writeUInt32BE(16, 4);
    input.write('ic07', 8);
    // A zero-size block must not spin forever, including when an upstream parser regresses.
    input.writeUInt32BE(0, 12);
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort, workerData } = require('node:worker_threads');
        try { require(workerData.adapter)(Buffer.from(workerData.hex, 'hex')); parentPort.postMessage('accepted'); }
        catch { parentPort.postMessage('rejected'); }
      `, { eval: true, workerData: { adapter: adapterPath, hex: input.toString('hex') } });
      const timer = setTimeout(() => {
        void worker.terminate();
        reject(new Error('Image parser failed to reject a non-advancing block within 2 seconds'));
      }, 2000);
      worker.once('message', (result) => {
        clearTimeout(timer);
        void worker.terminate();
        if (result === 'rejected') resolve(); else reject(new Error('Malformed image was accepted'));
      });
      worker.once('error', (error) => { clearTimeout(timer); reject(error); });
    });
  });
});
