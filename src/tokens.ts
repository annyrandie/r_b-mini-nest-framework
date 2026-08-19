export type InjectionToken = symbol | string;

export const CONFIG: InjectionToken = Symbol.for('CONFIG');
export const LOGGER: InjectionToken = Symbol.for('LOGGER');
