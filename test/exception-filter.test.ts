import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { Container } from '../src/container';
import { createApp } from '../src/dispatcher';
import { Controller } from '../src/decorators/controller';
import { Get } from '../src/decorators/methods';
import { mapErrorToResponse } from '../src/filters/exception.filter';
import { NotFoundError } from '../src/errors/not-found.error';
import { ValidationError } from '../src/errors/validation.error';
import { ForbiddenError } from '../src/errors/forbidden.error';

@Controller('boom')
class BoomController {
  @Get()
  explode(): never {
    throw new Error('boom');
  }
}

test('an unexpected error becomes a bare 500 — no "boom", no stack trace, in the response body', async () => {
  const container = new Container();
  const app = createApp(container, [BoomController]);
  const originalError = console.error;
  console.error = () => {}; // the filter is expected to log this — keep the test output clean

  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/boom`);
    const text = await res.text();

    assert.equal(res.status, 500);
    assert.doesNotMatch(text, /boom|at .*\.ts:/);
  } finally {
    console.error = originalError;
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});

test('mapErrorToResponse: NotFoundError -> 404 with its message', () => {
  const { status, body } = mapErrorToResponse(new NotFoundError('User "42" was not found'));
  assert.equal(status, 404);
  assert.deepEqual(body, { message: 'User "42" was not found' });
});

test('mapErrorToResponse: ValidationError -> 400 with the full field list', () => {
  const { status, body } = mapErrorToResponse(new ValidationError([{ field: 'email', constraints: ['must be an email'] }]));
  assert.equal(status, 400);
  assert.deepEqual(body, { message: 'Validation failed', errors: [{ field: 'email', constraints: ['must be an email'] }] });
});

test('mapErrorToResponse: ForbiddenError -> 403', () => {
  const { status } = mapErrorToResponse(new ForbiddenError());
  assert.equal(status, 403);
});

test('mapErrorToResponse: anything else -> 500 with a generic message, nothing leaked', () => {
  const { status, body } = mapErrorToResponse(new Error('some internal secret'));
  assert.equal(status, 500);
  assert.deepEqual(body, { message: 'Internal server error' });
});
