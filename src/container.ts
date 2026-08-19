import 'reflect-metadata';
import { INJECTABLE_METADATA_KEY, SCOPE_METADATA_KEY, Scope } from './decorators/injectable';
import { INJECT_TOKENS_METADATA_KEY } from './decorators/inject';
import type { InjectionToken } from './tokens';

export type Type<T = unknown> = new (...args: any[]) => T;

export type Resolvable<T = unknown> = Type<T> | InjectionToken;

export class CircularDependencyError extends Error {
  constructor(chain: string[]) {
    super(`Circular dependency detected: ${chain.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

function tokenName(token: InjectionToken): string {
  return typeof token === 'symbol' ? token.toString() : token;
}

export class Container {
  private readonly singletons = new Map<Type, unknown>();
  private readonly valueProviders = new Map<InjectionToken, unknown>();

  register(token: InjectionToken, value: unknown): void {
    this.valueProviders.set(token, value);
  }

  resolve<T>(target: Resolvable<T>): T {
    return this.resolveInternal(target, []);
  }

  private resolveInternal<T>(target: Resolvable<T>, path: string[]): T {
    if (typeof target === 'string' || typeof target === 'symbol') {
      return this.resolveToken(target, path);
    }

    return this.resolveClass(target as Type<T>, path);
  }

  private resolveToken<T>(token: InjectionToken, path: string[]): T {
    if (!this.valueProviders.has(token)) {
      throw new Error(`No provider registered for token "${tokenName(token)}". Did you call container.register(token, value)?`);
    }
    const provider = this.valueProviders.get(token);

    if (typeof provider === 'function' && Reflect.getMetadata(INJECTABLE_METADATA_KEY, provider)) {
      return this.resolveClass(provider as Type<T>, path);
    }

    return provider as T;
  }

  private resolveClass<T>(ctor: Type<T>, path: string[]): T {
    const name = ctor.name;

    if (path.includes(name)) {
      throw new CircularDependencyError([...path, name]);
    }

    if (!Reflect.getMetadata(INJECTABLE_METADATA_KEY, ctor)) {
      throw new Error(`"${name}" is not decorated with @Injectable() and cannot be resolved by the container.`);
    }

    const scope: Scope = Reflect.getMetadata(SCOPE_METADATA_KEY, ctor) ?? 'singleton';

    if (scope === 'singleton' && this.singletons.has(ctor)) {
      return this.singletons.get(ctor) as T;
    }

    const nextPath = [...path, name];

    const paramTypes: Type[] = Reflect.getMetadata('design:paramtypes', ctor) || [];
    const injectTokens: (InjectionToken | undefined)[] =
      Reflect.getMetadata(INJECT_TOKENS_METADATA_KEY, ctor) || [];

    const args = paramTypes.map((paramType, index) => {
      const dependency: Resolvable = injectTokens[index] ?? paramType;
      return this.resolveInternal(dependency, nextPath);
    });

    const instance = new ctor(...args);

    if (scope === 'singleton') {
      this.singletons.set(ctor, instance);
    }

    return instance;
  }
}
