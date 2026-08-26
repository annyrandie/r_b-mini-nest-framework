import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Container } from '../src/container';
import { createApp } from '../src/dispatcher';
import { UsersController } from '../src/controllers/users.controller';
import { LoggingInterceptor } from '../src/interceptors/logging.interceptor';

test('LoggingInterceptor logs the route and the elapsed time in milliseconds', async () => {
  const container = new Container();
  const app = createApp(container, [UsersController], { interceptors: [LoggingInterceptor] });

  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };

  try {
    const res = await fetch(`http://127.0.0.1:${port}/users?limit=5`);
    await res.json();
  } finally {
    console.log = originalLog;
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }

  const logged = lines.find((line) => line.includes('GET /users'));
  assert.ok(logged, `expected a log line for "GET /users", got: ${JSON.stringify(lines)}`);
  assert.match(logged!, /[0-9]+(\.[0-9]+)? ?ms/);
});
