import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';

@Injectable()
class SingletonService {}

@Injectable({ scope: 'transient' })
class TransientService {}

test('singleton: resolve(X) === resolve(X) for a class with no explicit scope', () => {
  const container = new Container();
  assert.equal(container.resolve(SingletonService), container.resolve(SingletonService));
});

test('transient: resolve(X) !== resolve(X) for @Injectable({ scope: "transient" })', () => {
  const container = new Container();
  assert.notEqual(container.resolve(TransientService), container.resolve(TransientService));
});
