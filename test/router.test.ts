import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container';
import { buildRoutes, matchRoute } from '../src/router';
import { UsersController } from '../src/controllers/users.controller';

test('route metadata, not a hardcoded list, drives the route table', () => {
  const container = new Container();
  const routes = buildRoutes(container, [UsersController]);

  assert.ok(routes.some((r) => r.httpMethod === 'GET' && r.segments.join('/') === 'users'));
  assert.ok(routes.some((r) => r.httpMethod === 'GET' && r.segments.join('/') === 'users/:id'));
  assert.ok(routes.some((r) => r.httpMethod === 'POST' && r.segments.join('/') === 'users'));
});

test('GET /users/:id matches and captures the :id param, not the plain /users route', () => {
  const container = new Container();
  const routes = buildRoutes(container, [UsersController]);

  const match = matchRoute(routes, 'GET', '/users/42');
  assert.ok(match);
  assert.equal(match.params.id, '42');
  assert.equal(match.route.segments.join('/'), 'users/:id');
});

test('unmatched method/path returns undefined instead of a wrong route', () => {
  const container = new Container();
  const routes = buildRoutes(container, [UsersController]);

  assert.equal(matchRoute(routes, 'DELETE', '/users/42'), undefined);
  assert.equal(matchRoute(routes, 'GET', '/unknown'), undefined);
});
