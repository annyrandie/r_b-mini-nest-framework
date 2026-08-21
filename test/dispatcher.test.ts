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

test('GET /users/:id resolves the prefix + :id route and passes it as a plain argument', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users/42`);
    const body = (await res.json()) as any;

    assert.equal(res.status, 200);
    assert.equal(body.id, '42');
  });
});

test('GET /users?limit=5 passes the query value as a separate argument', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users?limit=5`);
    const body = (await res.json()) as any;

    assert.equal(res.status, 200);
    assert.equal(body.limit, '5');
  });
});

test('POST /users with an invalid body is rejected with 400 naming the field', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada', email: 'not-an-email' }),
    });
    const text = await res.text();

    assert.equal(res.status, 400);
    assert.match(text, /email/);
  });
});

test('POST /users with a valid body reaches the handler and creates a user', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.test' }),
    });
    const body = (await res.json()) as any;

    assert.equal(res.status, 201);
    assert.equal(body.name, 'Ada Lovelace');
    assert.equal(body.email, 'ada@example.test');
    assert.equal(typeof body.id, 'number');
  });
});

test('an unknown route returns 404 instead of crashing the server', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/nope`);
    assert.equal(res.status, 404);
  });
});
