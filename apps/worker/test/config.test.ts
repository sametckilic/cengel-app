import { describe, expect, it } from 'vitest';

import { validateWorkerEnvironment } from '../src/config';

const requiredEnvironment: NodeJS.ProcessEnv = {
  DATABASE_URL: 'postgresql://user:password@example.com:5432/cengel',
  NODE_ENV: 'test',
};

describe('worker generator configuration', () => {
  it('defaults new worker runs to the versioned V2 generator', () => {
    const environment = validateWorkerEnvironment(requiredEnvironment);

    expect(environment.WORKER_GENERATOR_VERSION).toBe('newspaper-v2');
    expect(environment.WORKER_REVISION).toBe('schedule-v2');
  });

  it('keeps the legacy generator available for rollback', () => {
    const environment = validateWorkerEnvironment({
      ...requiredEnvironment,
      WORKER_GENERATOR_VERSION: 'newspaper-v1',
      WORKER_REVISION: 'schedule-v1',
    });

    expect(environment.WORKER_GENERATOR_VERSION).toBe('newspaper-v1');
    expect(environment.WORKER_REVISION).toBe('schedule-v1');
  });

  it('rejects unknown generator versions', () => {
    expect(() =>
      validateWorkerEnvironment({
        ...requiredEnvironment,
        WORKER_GENERATOR_VERSION: 'newspaper-v3',
      }),
    ).toThrow(/WORKER_GENERATOR_VERSION/);
  });
});
