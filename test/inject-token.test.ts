import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Container } from '../src/container';
import { Injectable } from '../src/decorators/injectable';
import { Inject } from '../src/decorators/inject';
import { CONFIG } from '../src/tokens';

interface AppConfig {
  apiUrl: string;
}

@Injectable()
class ConfigConsumer {
  constructor(@Inject(CONFIG) readonly config: AppConfig) {}
}

test('@Inject(token) resolves a dependency registered under a Symbol token, not by type', () => {
  const container = new Container();
  const config: AppConfig = { apiUrl: 'https://example.test' };
  container.register(CONFIG, config);

  const instance = container.resolve(ConfigConsumer);

  assert.equal(instance.config, config);
  assert.equal(instance.config.apiUrl, 'https://example.test');
});

test('resolving an unregistered token throws a clear error', () => {
  const container = new Container();
  assert.throws(() => container.resolve(ConfigConsumer), /No provider registered for token/);
});
