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
export { validateBody } from './pipes/validation.pipe';
export type { FieldError, ValidationResult } from './pipes/validation.pipe';
