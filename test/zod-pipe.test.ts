import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWithZod } from '../src/pipes/zod-validation.pipe';
import { ValidationError } from '../src/errors/validation.error';
import { createUserSchema } from '../src/dto/create-user.dto';

test('invalid body throws a ValidationError naming the offending field', () => {
  assert.throws(
    () => validateWithZod(createUserSchema, { name: 'Ada', email: 'not-an-email' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      assert.ok(error.fields.some((f) => f.field === 'email'));
      return true;
    },
  );
});

test('multiple invalid fields are all reported, not just the first', () => {
  assert.throws(
    () => validateWithZod(createUserSchema, { name: '', email: 'not-an-email' }),
    (error: unknown) => {
      assert.ok(error instanceof ValidationError);
      const fields = error.fields.map((f) => f.field).sort();
      assert.deepEqual(fields, ['email', 'name']);
      return true;
    },
  );
});

test('valid body produces a real parsed object of the inferred DTO shape', () => {
  const dto = validateWithZod(createUserSchema, { name: 'Ada', email: 'ada@example.test' });

  assert.equal(dto.name, 'Ada');
  assert.equal(dto.email, 'ada@example.test');
});
