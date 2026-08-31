import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Container } from '../src/container';
import { createApp } from '../src/dispatcher';
import { UsersController } from '../src/controllers/users.controller';
import { AuthGuard } from '../src/guards/auth.guard';

const AUTH = { Authorization: 'Bearer test-token' };

async function withServer<T>(fn: (baseUrl: string) => Promise<T>): Promise<T> {
  const container = new Container();
  const app = createApp(container, [UsersController], { guards: [AuthGuard] });

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
    const created = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
      body: JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.test' }),
    });
    const { id } = (await created.json()) as { id: number };

    const res = await fetch(`${baseUrl}/users/${id}`, { headers: AUTH });
    const body = (await res.json()) as any;

    assert.equal(res.status, 200);
    assert.equal(body.id, String(id));
  });
});

test('GET /users?limit=5 passes the query value as a separate argument', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users?limit=5`, { headers: AUTH });
    const body = (await res.json()) as any;

    assert.equal(res.status, 200);
    assert.equal(body.limit, '5');
  });
});

test('POST /users with an invalid body is rejected with 400 naming the field', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH },
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
      headers: { 'Content-Type': 'application/json', ...AUTH },
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
    const res = await fetch(`${baseUrl}/nope`, { headers: AUTH });
    assert.equal(res.status, 404);
  });
});

test('GET /users/:id for a missing user maps NotFoundError to 404 with a real message', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/users/999`, { headers: AUTH });
    const body = (await res.json()) as any;

    assert.equal(res.status, 404);
    assert.match(body.message, /999/);
  });
});

test('a request without Authorization is rejected by the guard before the handler runs', async () => {
  const container = new Container();
  let handlerCalls = 0;
  const app = createApp(container, [UsersController], { guards: [AuthGuard] });
  // Spy on the resolved controller instance to prove the handler body never runs.
  const controller = container.resolve(UsersController);
  const original = controller.list.bind(controller);
  controller.list = (...args: Parameters<typeof original>) => {
    handlerCalls++;
    return original(...args);
  };

  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/users`); // no Authorization header
    assert.equal(res.status, 403);
    assert.equal(handlerCalls, 0);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});
