import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateEnvironment } from '../src/config/environment';
import { createApiApplication } from '../src/create-app';
import { DatabaseService } from '../src/database/database.service';
import { HealthController } from '../src/health/health.controller';

describe('API health', () => {
  let app: NestFastifyApplication | undefined;

  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://cengel:cengel@127.0.0.1:1/cengel';
    process.env.DB_CONNECTION_TIMEOUT_MS = '100';
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('reports liveness without depending on PostgreSQL', async () => {
    app = await createApiApplication({ logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      checks: { api: 'up' },
      service: 'cengel-api',
      status: 'ok',
    });
  });

  it('reports readiness as unavailable when PostgreSQL cannot be reached', async () => {
    app = await createApiApplication({ logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: 'GET', url: '/ready' });

    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({
      checks: { api: 'up', database: 'down' },
      service: 'cengel-api',
      status: 'error',
    });
  });

  it('reports readiness when PostgreSQL responds', async () => {
    const database = {
      ping: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseService;
    const controller = new HealthController(database);

    await expect(controller.getReadiness()).resolves.toEqual({
      checks: { api: 'up', database: 'up' },
      service: 'cengel-api',
      status: 'ok',
    });
  });
});

describe('API configuration', () => {
  it('applies safe local defaults', () => {
    expect(
      validateEnvironment({
        DATABASE_URL: 'postgresql://cengel:cengel@localhost:54329/cengel',
      }),
    ).toEqual({
      DATABASE_SSL: false,
      DATABASE_URL: 'postgresql://cengel:cengel@localhost:54329/cengel',
      DB_CONNECTION_TIMEOUT_MS: 5000,
      DB_POOL_MAX: 10,
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('rejects invalid ports', () => {
    expect(() =>
      validateEnvironment({
        DATABASE_URL: 'postgresql://cengel:cengel@localhost:54329/cengel',
        PORT: '70000',
      }),
    ).toThrow(
      'Invalid API configuration',
    );
  });

  it('requires a PostgreSQL connection URL', () => {
    expect(() => validateEnvironment({})).toThrow('Invalid API configuration');
  });
});
