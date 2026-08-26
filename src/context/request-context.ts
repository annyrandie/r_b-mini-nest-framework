import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestStore {
  requestId: string;
}

const als = new AsyncLocalStorage<RequestStore>();

export function runWithRequestContext<T>(store: RequestStore, fn: () => T): T {
  return als.run(store, fn);
}

export function getRequestId(): string {
  const store = als.getStore();
  if (!store) {
    throw new Error('getRequestId() called outside of runWithRequestContext() — no request in flight');
  }
  return store.requestId;
}
