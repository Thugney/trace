import assert from 'node:assert/strict';
import { test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createMemoryRouter, Link, MemoryRouter } from 'react-router-dom';
import sharp from 'sharp';

test('router migration preserves parameter/query navigation and back navigation', async () => {
  const router = createMemoryRouter([
    { path: '/learn', element: React.createElement('p', null, 'Learn') },
    { path: '/learn/lesson/:lessonId', element: React.createElement('p', null, 'Lesson') },
  ], { initialEntries: ['/learn'] });
  try {
    await router.navigate('/learn/lesson/synthetic%20lesson?language=en');
    assert.equal(router.state.location.pathname, '/learn/lesson/synthetic%20lesson');
    assert.equal(router.state.location.search, '?language=en');
    assert.equal(router.state.matches.at(-1).params.lessonId, 'synthetic lesson');
    await router.navigate(-1);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(router.state.location.pathname, '/learn');
  } finally {
    router.dispose();
  }
});

test('declarative links preserve generated internal lesson destinations', () => {
  const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ['/learn'] },
    React.createElement(Link, { to: '/learn/lesson/synthetic%20lesson?language=en' }, 'Open')));
  const href = html.match(/href="([^"]+)"/)?.[1];
  assert.ok(href, 'Link renders a target');
  const resolved = new URL(href, 'https://familyhub.invalid');
  assert.equal(resolved.origin, 'https://familyhub.invalid');
  assert.equal(resolved.pathname, '/learn/lesson/synthetic%20lesson');
  assert.equal(resolved.search, '?language=en');
});

test('sharp migration preserves the SVG resize-to-PNG pipeline used for app icons', async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="green"/></svg>');
  const result = await sharp(svg).resize(64, 64).png().toBuffer({ resolveWithObject: true });
  assert.equal(result.info.format, 'png');
  assert.equal(result.info.width, 64);
  assert.equal(result.info.height, 64);
  assert.ok(result.data.length > 0);
});
