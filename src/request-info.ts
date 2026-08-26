import type http from 'node:http';

export interface RequestInfo {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  params: Record<string, string>;
  query: URLSearchParams;
}
