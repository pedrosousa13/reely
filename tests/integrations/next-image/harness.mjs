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
  server.kill('SIGTERM');
  await exited;
  clearTimeout(timeout);
};

export const startNext = async (cwd) => {
  const server = spawn(
    process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    ['exec', 'next', 'start', '--hostname', '127.0.0.1', '--port', '0'],
    { cwd, stdio: 'pipe' }
  );

  return new Promise((resolve, reject) => {
    let output = '';
    const ready = () => {
      const origin = localUrl(output);
      if (origin && output.includes('Ready')) resolve({ origin, server });
    };
    const capture = (chunk) => {
      output += chunk;
      ready();
    };
    server.stdout.on('data', capture);
    server.stderr.on('data', capture);
    server.once('exit', (code) =>
      reject(new Error(`next start exited with code ${code}.\n${output}`))
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
