import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, describe, expect, it } from 'vitest';

import { validateEnvironment } from '../src/config/environment';
import { createApiApplication } from '../src/create-app';

describe('API health', () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it.each(['/health', '/ready'])('reports %s as healthy', async (url) => {
    app = await createApiApplication({ logger: false });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: 'GET', url });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.json()).toEqual({
      checks: { api: 'up' },
      service: 'cengel-api',
      status: 'ok',
    });
  });
});

describe('API configuration', () => {
  it('applies safe local defaults', () => {
    expect(validateEnvironment({})).toEqual({
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      PORT: 3000,
    });
  });

  it('rejects invalid ports', () => {
    expect(() => validateEnvironment({ PORT: '70000' })).toThrow(
      'Invalid API configuration',
    );
  });
});
