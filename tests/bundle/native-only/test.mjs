import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import {
  extname,
  isAbsolute,
  normalize,
  relative,
  resolve,
  sep
} from 'node:path';
import { fileURLToPath, URL } from 'node:url';

const root = new URL('./dist/', import.meta.url);
const rootPath = fileURLToPath(root);
const manifest = JSON.parse(
  await readFile(new URL('.vite/manifest.json', root), 'utf8')
);
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);
if (!entryKey) throw new Error('The Vite manifest has no entry.');

const staticKeys = new Set();
const visitStatic = (key) => {
  if (staticKeys.has(key)) return;
  staticKeys.add(key);
  for (const imported of manifest[key]?.imports ?? []) visitStatic(imported);
};
visitStatic(entryKey);

const isProviderEntry = (key) => {
  const name = manifest[key]?.name ?? '';
  return (
    /(?:packages|@reely)\/provider-(?:native|hls|youtube|vimeo)/.test(key) ||
    /(?:packages|@reely)\/provider-(?:native|hls|youtube|vimeo)/.test(name)
  );
};
const providerKeys = Object.keys(manifest).filter(isProviderEntry);
const nativeProviderKey = providerKeys.find((key) => {
  const name = manifest[key]?.name ?? '';
  return key.includes('provider-native') || name.includes('provider-native');
});
if (!nativeProviderKey) {
  throw new Error('The consumer build did not emit a native provider chunk.');
}
for (const key of providerKeys) {
  if (staticKeys.has(key)) {
    throw new Error(`Provider adapter leaked into the initial graph: ${key}`);
  }
}

const mime = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mp4': 'video/mp4'
};
const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname =
      requestUrl.pathname === '/'
        ? '/index.html'
        : decodeURIComponent(requestUrl.pathname);
    const safePath = normalize(pathname.replaceAll('\\', '/')).replace(
      /^[/\\]+/,
      ''
    );
    const filePath = resolve(rootPath, safePath);
    const relativePath = relative(rootPath, filePath);
    if (
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new Error('Fixture request escaped the distribution directory.');
    }
    const body = await readFile(filePath);
    response.writeHead(200, {
      'content-type': mime[extname(filePath)] ?? 'application/octet-stream'
    });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

const nativeFile = `/${manifest[nativeProviderKey].file}`;
const requestedScripts = [];
let browser;
try {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Could not resolve fixture server address.');
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on('request', (request) => {
    if (request.resourceType() === 'script') {
      requestedScripts.push(new URL(request.url()).pathname);
    }
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  const activationButton = page.getByRole('button', { name: 'Play video' });
  await activationButton.waitFor();
  await activationButton.evaluate((button) => {
    button.addEventListener(
      'click',
      () => {
        globalThis.document.documentElement.dataset.nativeRequestClickTime =
          String(globalThis.performance.now());
      },
      { capture: true, once: true }
    );
  });
  if (requestedScripts.includes(nativeFile)) {
    throw new Error('Native provider loaded before interaction.');
  }
  const nativeUrl = new URL(nativeFile, page.url()).href;
  await Promise.all([
    page.waitForRequest((request) => {
      return request.resourceType() === 'script' && request.url() === nativeUrl;
    }),
    activationButton.click()
  ]);
  await page.waitForFunction(
    (url) =>
      globalThis.performance.getEntriesByName(url, 'resource').length > 0,
    nativeUrl
  );
  const { clickTime, startTimes } = await page.evaluate(
    (url) => ({
      clickTime: Number(
        globalThis.document.documentElement.dataset.nativeRequestClickTime
      ),
      startTimes: globalThis.performance
        .getEntriesByName(url, 'resource')
        .map(({ startTime }) => startTime)
    }),
    nativeUrl
  );
  if (
    !Number.isFinite(clickTime) ||
    startTimes.length === 0 ||
    startTimes.some((startTime) => startTime < clickTime)
  ) {
    throw new Error('Native provider request started before interaction.');
  }
} finally {
  try {
    await browser?.close();
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  }
}
