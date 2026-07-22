/* global URL, document, fetch, getComputedStyle */

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { runWithCleanup, startNext, terminate } from './harness.mjs';

const fixtureDirectory = fileURLToPath(new URL('.', import.meta.url));

const equalRectangles = (actual, expected) => {
  for (const key of ['x', 'y', 'width', 'height']) {
    assert.ok(
      Math.abs(actual[key] - expected[key]) < 0.01,
      `${key} differs: ${actual[key]} !== ${expected[key]}`
    );
  }
};

let browser;
const { origin, server } = await startNext(fixtureDirectory);

await runWithCleanup({
  run: async () => {
    const response = await fetch(`${origin}/`);
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
  },
  closeBrowser: () => browser?.close(),
  terminateServer: () => terminate(server)
});
