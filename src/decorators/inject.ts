import 'reflect-metadata';
import type { InjectionToken } from '../tokens';

export const INJECT_TOKENS_METADATA_KEY = Symbol('mini-nest:inject_tokens');

export function Inject(token: InjectionToken): ParameterDecorator {
  return (target, _propertyKey, parameterIndex) => {
    const ownTokens: (InjectionToken | undefined)[] =
      Reflect.getOwnMetadata(INJECT_TOKENS_METADATA_KEY, target) || [];
    ownTokens[parameterIndex] = token;
    Reflect.defineMetadata(INJECT_TOKENS_METADATA_KEY, ownTokens, target);
  };
}
