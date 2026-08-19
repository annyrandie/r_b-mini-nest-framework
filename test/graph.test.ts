import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';

@Injectable()
class C {
  readonly tag = 'C';
}

@Injectable()
class B {
  constructor(readonly c: C) {}
}

@Injectable()
class A {
  constructor(readonly b: B) {}
}

test('resolves a graph recursively: A -> B -> C', () => {
  const container = new Container();
  const a = container.resolve(A);

  assert.ok(a instanceof A);
  assert.ok(a.b instanceof B);
  assert.ok(a.b.c instanceof C);
  assert.equal(a.b.c.tag, 'C');
});

test('a class without @Injectable() cannot be resolved', () => {
  class NotDecorated {}
  const container = new Container();
  assert.throws(() => container.resolve(NotDecorated), /not decorated with @Injectable/);
});
