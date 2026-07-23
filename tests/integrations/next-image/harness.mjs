/* global clearTimeout, process, setTimeout */

import { spawn } from 'node:child_process';

const localUrl = (output) =>
  output.match(/- Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];

export const terminate = async (server) => {
  if (server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  const timeout = setTimeout(() => {
    if (server.exitCode === null) server.kill('SIGKILL');
  }, 5_000);
  try {
    if (!server.kill('SIGTERM')) return;
    await exited;
  } finally {
    clearTimeout(timeout);
  }
};

export const startNext = async (cwd, options) => {
  const { spawnProcess = spawn, startupTimeoutMs = 10_000 } = options ?? {};
  const server = spawnProcess(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', '0'],
    { cwd, stdio: 'pipe' }
  );

  return new Promise((resolve, reject) => {
    let settled = false;
    let output = '';
    let startupTimeout;
    const cleanup = () => {
      clearTimeout(startupTimeout);
      server.stdout.off('data', capture);
      server.stderr.off('data', capture);
      server.off('error', onError);
      server.off('exit', onExit);
    };
    const settle = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const fail = async (error) => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        await terminate(server);
      } catch {
        // Preserve the startup error as the primary failure.
      }
      reject(error);
    };
    const ready = () => {
      const origin = localUrl(output);
      if (origin && output.includes('Ready')) settle({ origin, server });
    };
    const capture = (chunk) => {
      output += chunk;
      ready();
    };
    const onError = (error) => void fail(error);
    const onExit = (code) =>
      void fail(new Error(`next start exited with code ${code}.\n${output}`));
    server.stdout.on('data', capture);
    server.stderr.on('data', capture);
    server.once('error', onError);
    server.once('exit', onExit);
    startupTimeout = setTimeout(
      () => void fail(new Error('Timed out waiting for next start.')),
      startupTimeoutMs
    );
  });
};

export const runWithCleanup = async ({
  run,
  closeBrowser,
  terminateServer
}) => {
  let result;
  let primaryError;
  try {
    result = await run();
  } catch (error) {
    primaryError = error;
  }

  let cleanupError;
  try {
    await closeBrowser();
  } catch (error) {
    cleanupError = error;
  }
  try {
    await terminateServer();
  } catch (error) {
    cleanupError ??= error;
  }

  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
  return result;
};
