import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import type { Type } from '../container';

export interface FieldError {
  field: string;
  constraints: string[];
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: FieldError[] };

function toFieldError(error: ValidationError): FieldError {
  return {
    field: error.property,
    constraints: error.constraints ? Object.values(error.constraints) : ['invalid value'],
  };
}

export function validateBody<T extends object>(dtoClass: Type<T>, body: unknown): ValidationResult<T> {
  const instance = plainToInstance(dtoClass, body ?? {});
  const errors = validateSync(instance, { whitelist: true, forbidUnknownValues: false });

  if (errors.length > 0) {
    return { ok: false, errors: errors.map(toFieldError) };
  }

  return { ok: true, value: instance };
}
