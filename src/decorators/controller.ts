import 'reflect-metadata';
import { INJECTABLE_METADATA_KEY, SCOPE_METADATA_KEY } from './injectable';

export const CONTROLLER_PREFIX_METADATA_KEY = Symbol('mini-nest:controller-prefix');

function stripSlashes(path: string): string {
  return path.replace(/^\/+|\/+$/g, '');
}

export function Controller(prefix = ''): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(CONTROLLER_PREFIX_METADATA_KEY, stripSlashes(prefix), target);
    Reflect.defineMetadata(INJECTABLE_METADATA_KEY, true, target);
    Reflect.defineMetadata(SCOPE_METADATA_KEY, 'singleton', target);
  };
}
