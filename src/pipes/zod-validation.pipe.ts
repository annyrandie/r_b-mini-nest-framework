import type { ZodType } from 'zod';
import { ValidationError, type FieldError } from '../errors/validation.error';

export function validateWithZod<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value ?? {});

  if (!result.success) {
    const fields: FieldError[] = result.error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
      constraints: [issue.message],
    }));
    throw new ValidationError(fields);
  }

  return result.data;
}
