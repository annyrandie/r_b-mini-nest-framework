import 'reflect-metadata';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Container, Type } from './container';
import { buildRoutes, matchRoute, type CompiledRoute } from './router';
import { validateWithZod } from './pipes/zod-validation.pipe';
import { mapErrorToResponse } from './filters/exception.filter';
import { runWithRequestContext } from './context/request-context';
import { ForbiddenError } from './errors/forbidden.error';
import { HttpError } from './http-error';
import type { RequestInfo } from './request-info';
import type { CanActivate } from './guards/guard';
import type { Interceptor } from './interceptors/interceptor';

export type MiddlewareFn = (req: RequestInfo) => void | Promise<void>;

export interface CreateAppOptions {
  middlewares?: MiddlewareFn[];
  guards?: Type<CanActivate>[];
  interceptors?: Type<Interceptor>[];
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new SyntaxError('Invalid JSON body'));
      }
    });
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function firstHeaderValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Pipe stage: parses the body once, then runs each `@Body(schema)` argument
 *  through `validateWithZod`. Bad JSON is a client fault too, just one that
 *  happens before any schema gets a chance to run. */
async function resolveArgs(route: CompiledRoute, params: Record<string, string>, url: URL, req: http.IncomingMessage): Promise<unknown[]> {
  const needsBody = Object.values(route.paramDefs).some((def) => def.source === 'body');

  let body: unknown;
  try {
    body = needsBody ? await readJsonBody(req) : undefined;
  } catch (error) {
    throw new HttpError(400, error instanceof Error ? error.message : 'Invalid JSON body');
  }

  const args: unknown[] = [];
  for (let index = 0; index < route.paramTypes.length; index++) {
    const def = route.paramDefs[index];
    if (!def) continue;

    if (def.source === 'param') {
      args[index] = def.name ? params[def.name] : undefined;
    } else if (def.source === 'query') {
      args[index] = def.name ? url.searchParams.get(def.name) ?? undefined : undefined;
    } else if (def.source === 'body') {
      args[index] = def.schema ? validateWithZod(def.schema, body) : body;
    }
  }

  return args;
}

/** Handler stage: nothing but the call. Whatever it throws — domain error or
 *  plain bug — is left to propagate; mapping it to a status is the exception
 *  filter's job alone, not this function's. */
function invokeHandler(route: CompiledRoute, args: unknown[]): Promise<unknown> {
  const handler = (route.controller as Record<string | symbol, (...a: unknown[]) => unknown>)[route.handlerName];
  return Promise.resolve(handler.apply(route.controller, args));
}

export function createApp(container: Container, controllers: Type<object>[], options: CreateAppOptions = {}): http.Server {
  const routes = buildRoutes(container, controllers);
  const middlewares = options.middlewares ?? [];
  const guards = (options.guards ?? []).map((GuardClass) => container.resolve<CanActivate>(GuardClass));
  const interceptors = (options.interceptors ?? []).map((InterceptorClass) => container.resolve<Interceptor>(InterceptorClass));

  return http.createServer((req, res) => {
    void (async () => {
      // Entry point: resolve the request id and open its AsyncLocalStorage
      // context. Everything below — middleware through the exception filter —
      // runs inside this callback, so every stage (and anything a service
      // calls three functions deep) can read it back with getRequestId().
      const requestId = firstHeaderValue(req.headers['x-request-id']) || randomUUID();
      res.setHeader('X-Request-Id', requestId);

      await runWithRequestContext({ requestId }, async () => {
        try {
          const method = (req.method ?? 'GET').toUpperCase();
          const url = new URL(req.url ?? '/', 'http://localhost');

          const match = matchRoute(routes, method, url.pathname);
          if (!match) {
            sendJson(res, 404, { message: `Cannot ${method} ${url.pathname}` });
            return;
          }

          const { route, params } = match;
          const reqInfo: RequestInfo = { method, path: url.pathname, headers: req.headers, params, query: url.searchParams };

          // Middleware stage.
          for (const middleware of middlewares) {
            await middleware(reqInfo);
          }

          // Guard stage — pass/reject before validation or the handler ever run.
          for (const guard of guards) {
            const allowed = await guard.canActivate(reqInfo);
            if (!allowed) throw new ForbiddenError();
          }

          // Interceptor stage, composed outside-in around pipe + handler.
          const finalNext = async () => {
            const args = await resolveArgs(route, params, url, req); // pipe
            return invokeHandler(route, args); // handler
          };
          const chain = interceptors.reduceRight<() => Promise<unknown>>(
            (next, interceptor) => () => interceptor.intercept(reqInfo, next),
            finalNext,
          );

          const result = await chain();
          sendJson(res, method === 'POST' ? 201 : 200, result);
        } catch (error) {
          // Exception filter — the one place every failure above funnels through.
          const { status, body } = mapErrorToResponse(error);
          sendJson(res, status, body);
        }
      });
    })();
  });
}
