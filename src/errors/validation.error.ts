export interface FieldError {
  field: string;
  constraints: string[];
}

export class ValidationError extends Error {
  constructor(public readonly fields: FieldError[]) {
    super('Validation failed');
    this.name = 'ValidationError';
  }
}
