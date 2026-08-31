import 'reflect-metadata';
import { performance } from 'node:perf_hooks';
import { Injectable } from '../decorators/injectable';
import type { Interceptor } from './interceptor';
import type { RequestInfo } from '../request-info';

@Injectable()
export class LoggingInterceptor implements Interceptor {
  async intercept(req: RequestInfo, next: () => Promise<unknown>): Promise<unknown> {
    const start = performance.now();
    try {
      return await next();
    } finally {
      const ms = (performance.now() - start).toFixed(1);
      console.log(`${req.method} ${req.path} — ${ms} ms`);
    }
  }
}
