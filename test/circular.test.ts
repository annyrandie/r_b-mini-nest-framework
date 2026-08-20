import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container, CircularDependencyError } from '../src/container';
import { Injectable } from '../src/decorators/injectable';
import { Inject } from '../src/decorators/inject';

const CIRC_A_TOKEN = Symbol('CircA');

@Injectable()
class CircB {
  constructor(@Inject(CIRC_A_TOKEN) readonly a: unknown) {}
}

@Injectable()
class CircA {
  constructor(readonly b: CircB) {}
}

test('a circular dependency throws a CircularDependencyError naming the full chain', () => {
  const container = new Container();
  container.register(CIRC_A_TOKEN, CircA);

  assert.throws(
    () => container.resolve(CircA),
    (error: unknown) => {
      assert.ok(error instanceof CircularDependencyError);
      assert.ok(!(error instanceof RangeError));
      assert.match((error as Error).message, /CircA -> CircB -> CircA/);
      return true;
    },
  );
});
