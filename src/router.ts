import 'reflect-metadata';
import type { Container, Type } from './container';
import { CONTROLLER_PREFIX_METADATA_KEY } from './decorators/controller';
import { ROUTE_HANDLERS_METADATA_KEY, ROUTE_METADATA_KEY, type HttpMethod, type RouteDefinition } from './decorators/methods';
import { PARAMS_METADATA_KEY, type ParamDefinition } from './decorators/params';

export interface CompiledRoute {
  httpMethod: HttpMethod;
  segments: string[];
  controller: object;
  handlerName: string | symbol;
  paramDefs: Record<number, ParamDefinition>;
  paramTypes: Type[];
}

function toSegments(prefix: string, path: string): string[] {
  return `${prefix}/${path}`.split('/').filter(Boolean);
}

export function buildRoutes(container: Container, controllers: Type<object>[]): CompiledRoute[] {
  const routes: CompiledRoute[] = [];

  for (const ControllerClass of controllers) {
    const prefix: string = Reflect.getMetadata(CONTROLLER_PREFIX_METADATA_KEY, ControllerClass) ?? '';
    const prototype = ControllerClass.prototype as object;
    const handlerNames: (string | symbol)[] = Reflect.getOwnMetadata(ROUTE_HANDLERS_METADATA_KEY, prototype) || [];
    const controllerInstance = container.resolve<object>(ControllerClass);

    for (const handlerName of handlerNames) {
      const route: RouteDefinition | undefined = Reflect.getMetadata(ROUTE_METADATA_KEY, prototype, handlerName);
      if (!route) continue;

      const paramDefs: Record<number, ParamDefinition> =
        Reflect.getOwnMetadata(PARAMS_METADATA_KEY, prototype, handlerName) || {};
      const paramTypes: Type[] = Reflect.getMetadata('design:paramtypes', prototype, handlerName) || [];

      routes.push({
        httpMethod: route.httpMethod,
        segments: toSegments(prefix, route.path),
        controller: controllerInstance,
        handlerName,
        paramDefs,
        paramTypes,
      });
    }
  }

  return routes;
}

export interface MatchedRoute {
  route: CompiledRoute;
  params: Record<string, string>;
}

export function matchRoute(routes: CompiledRoute[], httpMethod: string, pathname: string): MatchedRoute | undefined {
  const requestSegments = pathname.split('/').filter(Boolean);

  for (const route of routes) {
    if (route.httpMethod !== httpMethod) continue;
    if (route.segments.length !== requestSegments.length) continue;

    const params: Record<string, string> = {};
    const isMatch = route.segments.every((segment, index) => {
      if (segment.startsWith(':')) {
        params[segment.slice(1)] = decodeURIComponent(requestSegments[index]);
        return true;
      }
      return segment === requestSegments[index];
    });

    if (isMatch) return { route, params };
  }

  return undefined;
}
