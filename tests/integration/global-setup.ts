import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { TestProject } from 'vitest/node';

const ROOT = path.resolve(import.meta.dirname, '../..');
const BIN = path.join(ROOT, 'pocketbase');
const SUPERUSER = { email: 'superuser@example.test', password: 'superuser-password' };

declare module 'vitest' {
  export interface ProvidedContext {
    pbUrl: string;
    superuser: { email: string; password: string };
  }
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(url: string, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${url}/api/health`)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`PocketBase did not become healthy at ${url}`);
}

export default async function setup(project: TestProject) {
  if (!existsSync(BIN)) {
    throw new Error('PocketBase binary not found. Run `npm run pb:setup` first.');
  }
  if (!existsSync(path.join(ROOT, 'pb_hooks/generated/shared.cjs'))) {
    throw new Error('Hooks bundle not found. Run `npm run build:hooks` first.');
  }

  const dataDir = mkdtempSync(path.join(tmpdir(), 'pb-test-'));
  const dirs = [
    '--dir', dataDir,
    '--migrationsDir', path.join(ROOT, 'pb_migrations'),
    '--hooksDir', path.join(ROOT, 'pb_hooks'),
  ];
  execFileSync(BIN, ['superuser', 'upsert', SUPERUSER.email, SUPERUSER.password, ...dirs]);

  const port = await freePort();
  const url = `http://127.0.0.1:${port}`;
  const server = spawn(BIN, ['serve', '--http', `127.0.0.1:${port}`, ...dirs], {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  server.stdout.on('data', (d) => (output += d));
  server.stderr.on('data', (d) => (output += d));

  try {
    await waitForHealth(url);
  } catch (err) {
    server.kill();
    throw new Error(`${(err as Error).message}\n${output}`);
  }

  project.provide('pbUrl', url);
  project.provide('superuser', SUPERUSER);

  return () => {
    server.kill();
    rmSync(dataDir, { recursive: true, force: true });
  };
}
