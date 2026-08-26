import 'reflect-metadata';
import { Injectable } from '../decorators/injectable';
import type { CanActivate } from './guard';
import type { RequestInfo } from '../request-info';

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(req: RequestInfo): boolean {
    return Boolean(req.headers.authorization);
  }
}
