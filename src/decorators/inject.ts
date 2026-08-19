import 'reflect-metadata';
import type { InjectionToken } from '../tokens';

export const INJECT_TOKENS_METADATA_KEY = Symbol('mini-nest:inject_tokens');

export function Inject(token: InjectionToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const existingTokens: (InjectionToken | undefined)[] =
      Reflect.getMetadata(INJECT_TOKENS_METADATA_KEY, target) || [];
    existingTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKENS_METADATA_KEY, existingTokens, target);
  };
}
