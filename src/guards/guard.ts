import type { RequestInfo } from '../request-info';

export interface CanActivate {
  canActivate(req: RequestInfo): boolean | Promise<boolean>;
}
