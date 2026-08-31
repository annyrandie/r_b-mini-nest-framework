import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Container } from '../src/container';
import { createApp } from '../src/dispatcher';
import { UsersController } from '../src/controllers/users.controller';

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const container = new Container();
  const app = createApp(container, [UsersController]);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
}

test('a client-supplied X-Request-Id is echoed back verbatim', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users/1`, { headers: { 'X-Request-Id': 'client-picked-id-123' } });
    assert.equal(res.headers.get('x-request-id'), 'client-picked-id-123');
  });
});

test('with no X-Request-Id sent, the server generates one and returns it — a different one per request', async () => {
  await withServer(async (baseUrl) => {
    const [a, b] = await Promise.all([fetch(`${baseUrl}/users/1`), fetch(`${baseUrl}/users/1`)]);

    const idA = a.headers.get('x-request-id');
    const idB = b.headers.get('x-request-id');

    assert.ok(idA, 'response is missing an X-Request-Id header');
    assert.ok(idB, 'response is missing an X-Request-Id header');
    assert.notEqual(idA, idB);
  });
});

test('a service call two levels below the handler reads the same request id via AsyncLocalStorage — no id parameter passed to it', async () => {
  await withServer(async (baseUrl) => {
    const lines: string[] = [];
    const originalLog = console.log;
    console.log = (...args: unknown[]) => lines.push(args.map(String).join(' '));

    try {
      await fetch(`${baseUrl}/users/1`, { headers: { 'X-Request-Id': 'als-deep-read-test' } });
    } finally {
      console.log = originalLog;
    }

    const fromService = lines.find((line) => line.startsWith('[users.service]'));
    assert.ok(fromService, `expected a log line from users.service, got: ${JSON.stringify(lines)}`);
    assert.match(fromService!, /requestId=als-deep-read-test/);
  });
});
