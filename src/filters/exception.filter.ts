import { NotFoundError } from '../errors/not-found.error';
import { ValidationError } from '../errors/validation.error';
import { ForbiddenError } from '../errors/forbidden.error';
import { HttpError } from '../http-error';

export interface ErrorResponse {
  status: number;
  body: unknown;
}

export function mapErrorToResponse(error: unknown): ErrorResponse {
  if (error instanceof NotFoundError) {
    return { status: 404, body: { message: error.message } };
  }

  if (error instanceof ValidationError) {
    return { status: 400, body: { message: 'Validation failed', errors: error.fields } };
  }

  if (error instanceof ForbiddenError) {
    return { status: 403, body: { message: error.message } };
  }

  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: error.details === undefined ? { message: error.message } : { message: error.message, errors: error.details },
    };
  }

  console.error('[exception-filter] unhandled error:', error);
  return { status: 500, body: { message: 'Internal server error' } };
}
