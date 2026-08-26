import type { RequestInfo } from '../request-info';

export interface Interceptor {
  intercept(req: RequestInfo, next: () => Promise<unknown>): Promise<unknown>;
}
