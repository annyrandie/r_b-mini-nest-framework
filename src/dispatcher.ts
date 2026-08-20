import 'reflect-metadata';
import http from 'node:http';
import type { Container, Type } from './container';
import { buildRoutes, matchRoute } from './router';
import { validateBody } from './pipes/validation.pipe';

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

export function createApp(container: Container, controllers: Type<object>[]): http.Server {
  const routes = buildRoutes(container, controllers);

  return http.createServer((req, res) => {
    void (async () => {
      try {
        const method = (req.method ?? 'GET').toUpperCase();
        const url = new URL(req.url ?? '/', 'http://localhost');
        const match = matchRoute(routes, method, url.pathname);

        if (!match) {
          sendJson(res, 404, { message: `Cannot ${method} ${url.pathname}` });
          return;
        }

        const { route, params } = match;
        const needsBody = Object.values(route.paramDefs).some((def) => def.source === 'body');
        const body = needsBody ? await readJsonBody(req) : undefined;

        const args: unknown[] = [];
        for (let index = 0; index < route.paramTypes.length; index++) {
          const def = route.paramDefs[index];
          if (!def) continue;

          if (def.source === 'param') {
            args[index] = def.name ? params[def.name] : undefined;
          } else if (def.source === 'query') {
            args[index] = def.name ? url.searchParams.get(def.name) ?? undefined : undefined;
          } else if (def.source === 'body') {
            const dtoClass = route.paramTypes[index] as Type<object>;
            const result = validateBody(dtoClass, body);
            if (!result.ok) {
              sendJson(res, 400, { message: 'Validation failed', errors: result.errors });
              return;
            }
            args[index] = result.value;
          }
        }

        const handler = (route.controller as Record<string | symbol, (...a: unknown[]) => unknown>)[route.handlerName];
        const result = await handler.apply(route.controller, args);

        sendJson(res, method === 'POST' ? 201 : 200, result);
      } catch (error) {
        sendJson(res, 400, { message: error instanceof Error ? error.message : 'Bad request' });
      }
    })();
  });
}
