import 'reflect-metadata';

export type HttpMethod = 'GET' | 'POST';

export interface RouteDefinition {
  httpMethod: HttpMethod;
  path: string;
}

export const ROUTE_METADATA_KEY = Symbol('mini-nest:route');
export const ROUTE_HANDLERS_METADATA_KEY = Symbol('mini-nest:route-handlers');

function stripLeadingSlash(path: string): string {
  return path.replace(/^\/+/, '');
}

function registerRoute(httpMethod: HttpMethod, path: string): MethodDecorator {
  return ((target: object, propertyKey: string | symbol) => {
    Reflect.defineMetadata(ROUTE_METADATA_KEY, { httpMethod, path: stripLeadingSlash(path) }, target, propertyKey);

    const ownHandlers: (string | symbol)[] = Reflect.getOwnMetadata(ROUTE_HANDLERS_METADATA_KEY, target) || [];
    ownHandlers.push(propertyKey);
    Reflect.defineMetadata(ROUTE_HANDLERS_METADATA_KEY, ownHandlers, target);
  }) as MethodDecorator;
}

export function Get(path = ''): MethodDecorator {
  return registerRoute('GET', path);
}

export function Post(path = ''): MethodDecorator {
  return registerRoute('POST', path);
}
