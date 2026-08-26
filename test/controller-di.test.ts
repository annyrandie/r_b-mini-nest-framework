import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container';
import { UsersController } from '../src/controllers/users.controller';
import { UsersService } from '../src/services/users.service';
import { runWithRequestContext } from '../src/context/request-context';

test('a controller is built by the part-1 container, so its injected service is the same singleton', () => {
  const container = new Container();

  const controller = container.resolve(UsersController);
  const serviceFromContainer = container.resolve(UsersService);

  assert.equal(controller.usersService, serviceFromContainer);

  // UsersService reads the request id via AsyncLocalStorage (see request-context.ts),
  // so — same as inside a real request — it needs a context to run in.
  runWithRequestContext({ requestId: 'controller-di-test' }, () => {
    controller.usersService.create({ name: 'Ada', email: 'ada@example.test' });
  });
  assert.equal(serviceFromContainer.list().length, 1);
});
