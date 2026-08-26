import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { z } from 'zod';
import { Container } from '../src/container';
import { createApp, type MiddlewareFn } from '../src/dispatcher';
import { Injectable } from '../src/decorators/injectable';
import { Controller } from '../src/decorators/controller';
import { Post } from '../src/decorators/methods';
import { Body } from '../src/decorators/params';
import type { CanActivate } from '../src/guards/guard';
import type { Interceptor } from '../src/interceptors/interceptor';
import type { RequestInfo } from '../src/request-info';

function buildProbeApp(trace: string[]) {
  const schema = z
    .object({ value: z.string() })
    .transform((data) => {
      trace.push('pipe'); // pipe stage: zod validates *and* transforms right before the handler
      return data;
    });

  @Controller('probe')
  class ProbeController {
    @Post()
    handle(@Body(schema) dto: { value: string }) {
      trace.push('handler');
      return dto;
    }
  }

  const middleware: MiddlewareFn = () => {
    trace.push('middleware');
  };

  @Injectable()
  class SpyGuard implements CanActivate {
    canActivate(): boolean {
      trace.push('guard');
      return true;
    }
  }

  @Injectable()
  class SpyInterceptor implements Interceptor {
    async intercept(_req: RequestInfo, next: () => Promise<unknown>): Promise<unknown> {
      trace.push('interceptor:before');
      const result = await next();
      trace.push('interceptor:after');
      return result;
    }
  }

  const container = new Container();
  const app = createApp(container, [ProbeController], {
    middlewares: [middleware],
    guards: [SpyGuard],
    interceptors: [SpyInterceptor],
  });

  return app;
}

test('the pipeline runs in exactly this order: middleware -> guard -> interceptor:before -> pipe -> handler -> interceptor:after', async () => {
  const trace: string[] = [];
  const app = buildProbeApp(trace);

  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/probe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x' }),
    });
    await res.json();

    assert.deepEqual(trace, ['middleware', 'guard', 'interceptor:before', 'pipe', 'handler', 'interceptor:after']);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});

test('10 concurrent requests never mix up each other\'s request id in the response header', async () => {
  const container = new Container();

  @Controller('slow')
  class SlowController {
    @Post()
    async handle(): Promise<{ ok: true }> {
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));
      return { ok: true };
    }
  }

  const app = createApp(container, [SlowController]);
  await new Promise<void>((resolve) => app.listen(0, resolve));
  const { port } = app.address() as AddressInfo;

  try {
    const ids = Array.from({ length: 10 }, (_, i) => `req-${i}`);
    const responses = await Promise.all(
      ids.map((id) =>
        fetch(`http://127.0.0.1:${port}/slow`, {
          method: 'POST',
          headers: { 'X-Request-Id': id },
        }),
      ),
    );

    const echoed = responses.map((res) => res.headers.get('x-request-id'));
    assert.deepEqual(echoed, ids, 'each response must echo back exactly the request id it was sent with');
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});
