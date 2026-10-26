'use strict';

const fs = require('node:fs');
const { imageSize, disableTypes, types } = require('patched-image-size');

// image-size v1 read at most 512 KiB from paths. H5PEditor still calls this
// synchronous API; v2 moved path reads to a separate asynchronous entry point.
const MAX_HEADER_BYTES = 512 * 1024;

function sizeOf(input) {
  if (input instanceof Uint8Array) return imageSize(input);
  if (typeof input !== 'string' || input.length === 0) {
    throw new TypeError('Expected an image buffer or non-empty file path');
  }

  const fd = fs.openSync(input, 'r');
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size === 0) {
      throw new TypeError('Expected a non-empty image file');
    }
    const header = Buffer.alloc(Math.min(stat.size, MAX_HEADER_BYTES));
    let bytesRead = 0;
    while (bytesRead < header.length) {
      const count = fs.readSync(fd, header, bytesRead, header.length - bytesRead, bytesRead);
      if (count === 0) break;
      bytesRead += count;
    }
    return imageSize(header.subarray(0, bytesRead));
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = sizeOf;
module.exports.default = sizeOf;
module.exports.imageSize = sizeOf;
module.exports.disableTypes = disableTypes;
module.exports.types = types;
