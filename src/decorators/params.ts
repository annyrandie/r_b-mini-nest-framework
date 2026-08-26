import 'reflect-metadata';
import type { ZodType } from 'zod';

export type ParamSource = 'body' | 'param' | 'query';

export interface ParamDefinition {
  source: ParamSource;
  name?: string;
  /** Only set for `source: 'body'` — the schema the zod pipe validates against. */
  schema?: ZodType;
}

export const PARAMS_METADATA_KEY = Symbol('mini-nest:params');

function registerParam(source: ParamSource, name?: string, schema?: ZodType): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    if (propertyKey === undefined) return; // constructor parameters aren't routed — @Inject covers those

    const ownParams: Record<number, ParamDefinition> =
      Reflect.getOwnMetadata(PARAMS_METADATA_KEY, target, propertyKey) || {};
    ownParams[parameterIndex] = { source, name, schema };
    Reflect.defineMetadata(PARAMS_METADATA_KEY, ownParams, target, propertyKey);
  };
}

/** Binds the parameter to the parsed request body. `schema` is run as the pipe
 *  stage — right before the handler is called — via `validateWithZod()`. */
export function Body(schema?: ZodType): ParameterDecorator {
  return registerParam('body', undefined, schema);
}

/** Binds the parameter to a named URL path segment, e.g. `:id` in `@Get(':id')`. */
export function Param(name: string): ParameterDecorator {
  return registerParam('param', name);
}

/** Binds the parameter to a named query-string value, e.g. `?limit=5`. */
export function Query(name: string): ParameterDecorator {
  return registerParam('query', name);
}
