/* global URL, clearTimeout, document, fetch, getComputedStyle, process, setTimeout */

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const fixtureDirectory = fileURLToPath(new URL('.', import.meta.url));

const selectPort = async () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        reject(new Error('Could not select a loopback port.'));
        return;
      }
      server.close((error) => (error ? reject(error) : resolve(address.port)));
    });
  });

const waitForServer = async (url, process) => {
  let lastError;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (process.exitCode !== null) {
      throw new Error(`next start exited with code ${process.exitCode}.`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      lastError = new Error(`Server returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError ?? new Error('Timed out waiting for next start.');
};

const terminate = async (process) => {
  if (process.exitCode !== null) return;
  const exited = new Promise((resolve) => process.once('exit', resolve));
  const timeout = setTimeout(() => {
    if (process.exitCode === null) process.kill('SIGKILL');
  }, 5_000);
  process.kill('SIGTERM');
  await exited;
  clearTimeout(timeout);
};

const equalRectangles = (actual, expected) => {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) < 0.01,
      `${key} differs: ${actual[key]} !== ${expected[key]}`
    );
  }
};

const port = await selectPort();
const origin = `http://127.0.0.1:${port}`;
const server = spawn(
  process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
  ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
  { cwd: fixtureDirectory, stdio: 'pipe' }
);
let browser;

try {
  const response = await waitForServer(`${origin}/`, server);
  const html = await response.text();
  assert.match(html, /data-reely-part="poster"/);
  assert.match(html, /srcset=/i);
  assert.match(html, /sizes=/);

  browser = await chromium.launch();
  const page = await browser.newPage();
  const failures = [];

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== origin && url.protocol !== 'data:') {
      failures.push(`External request: ${url.href}`);
      await route.abort();
      return;
    }
    await route.continue();
  });
  page.on('console', (message) => {
    if (message.type() === 'error')
      failures.push(`Console error: ${message.text()}`);
  });
  page.on('pageerror', (error) =>
    failures.push(`Page error: ${error.message}`)
  );

  await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => document.documentElement.dataset.hydrated === 'true'
  );

  const markup = await page
    .locator('[data-reely-part="poster"] img[alt=""]')
    .evaluate((image) => ({
      position: getComputedStyle(image).position,
      srcset: image.getAttribute('srcset'),
      sizes: image.getAttribute('sizes'),
      image: image.getBoundingClientRect().toJSON(),
      poster: image
        .closest('[data-reely-part="poster"]')
        ?.getBoundingClientRect()
        .toJSON()
    }));
  assert.equal(markup.position, 'absolute');
  assert.ok(markup.srcset, 'Expected Next Image responsive srcset markup.');
  assert.ok(markup.sizes, 'Expected Next Image sizes markup.');
  assert.ok(markup.poster, 'Expected image to be inside Player.Poster.');
  equalRectangles(markup.image, markup.poster);
  assert.deepEqual(failures, []);
} finally {
  await browser?.close();
  await terminate(server);
}
