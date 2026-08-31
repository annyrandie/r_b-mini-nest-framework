import 'reflect-metadata';

export { Container, CircularDependencyError } from './container';
export type { Type, Resolvable } from './container';
export { Injectable } from './decorators/injectable';
export type { Scope, InjectableOptions } from './decorators/injectable';
export { Inject } from './decorators/inject';
export * from './tokens';

export { Controller } from './decorators/controller';
export { Get, Post } from './decorators/methods';
export type { HttpMethod } from './decorators/methods';
export { Body, Param, Query } from './decorators/params';
export type { ParamSource, ParamDefinition } from './decorators/params';
export { buildRoutes, matchRoute } from './router';
export type { CompiledRoute, MatchedRoute } from './router';
export { createApp } from './dispatcher';
export type { CreateAppOptions, MiddlewareFn } from './dispatcher';
export type { RequestInfo } from './request-info';

export { validateWithZod } from './pipes/zod-validation.pipe';
export type { CanActivate } from './guards/guard';
export { AuthGuard } from './guards/auth.guard';
export type { Interceptor } from './interceptors/interceptor';
export { LoggingInterceptor } from './interceptors/logging.interceptor';
export { mapErrorToResponse } from './filters/exception.filter';
export type { ErrorResponse } from './filters/exception.filter';
export { NotFoundError } from './errors/not-found.error';
export { ValidationError } from './errors/validation.error';
export type { FieldError } from './errors/validation.error';
export { ForbiddenError } from './errors/forbidden.error';
export { HttpError } from './http-error';

export { runWithRequestContext, getRequestId } from './context/request-context';
export type { RequestStore } from './context/request-context';
