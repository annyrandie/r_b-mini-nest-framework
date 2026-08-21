import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBody } from '../src/pipes/validation.pipe';
import { CreateUserDto } from '../src/dto/create-user.dto';

test('invalid DTO body is rejected with the offending field named', () => {
  const result = validateBody(CreateUserDto, { name: 'Ada', email: 'not-an-email' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((e) => e.field === 'email'));
  }
});

test('valid DTO body produces a real CreateUserDto instance, not a plain object', () => {
  const result = validateBody(CreateUserDto, { name: 'Ada', email: 'ada@example.test' });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.ok(result.value instanceof CreateUserDto);
    assert.equal(result.value.email, 'ada@example.test');
  }
});
