import assert from 'node:assert/strict';
import test from 'node:test';
import { runWithCleanup } from './harness.mjs';

test('terminates Next after browser cleanup fails', async () => {
  const browserFailure = new Error('browser close failed');
  const calls = [];

  await assert.rejects(
    runWithCleanup({
      run: async () => undefined,
      closeBrowser: async () => {
        calls.push('browser');
        throw browserFailure;
      },
      terminateServer: async () => calls.push('server')
    }),
    browserFailure
  );

  assert.deepEqual(calls, ['browser', 'server']);
});

test('preserves the production failure after both cleanup attempts', async () => {
  const productionFailure = new Error('production assertion failed');
  const calls = [];

  await assert.rejects(
    runWithCleanup({
      run: async () => {
        throw productionFailure;
      },
      closeBrowser: async () => calls.push('browser'),
      terminateServer: async () => calls.push('server')
    }),
    productionFailure
  );

  assert.deepEqual(calls, ['browser', 'server']);
});
