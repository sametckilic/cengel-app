import { z } from 'zod';

const environmentSchema = z.object({
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:8081,http://localhost:19006')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DATABASE_URL: z.string().refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'DATABASE_URL must be a PostgreSQL connection URL.',
  ),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(60_000).default(5000),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  REVENUECAT_ALLOWED_ENVIRONMENTS: z
    .string()
    .default('SANDBOX')
    .transform((value) =>
      value
        .split(',')
        .map((environment) => environment.trim().toUpperCase())
        .filter(Boolean),
    )
    .refine(
      (environments) =>
        environments.length > 0 &&
        environments.every(
          (environment) =>
            environment === 'SANDBOX' || environment === 'PRODUCTION',
        ),
      'REVENUECAT_ALLOWED_ENVIRONMENTS must contain SANDBOX and/or PRODUCTION.',
    ),
  REVENUECAT_WEBHOOK_AUTHORIZATION: z.string().min(16).optional(),
  SUPABASE_URL: z.url().optional(),
});

export type ApiEnvironment = z.infer<typeof environmentSchema>;

export function validateEnvironment(
  environment: Record<string, unknown>,
): ApiEnvironment {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(`Invalid API configuration: ${z.prettifyError(result.error)}`);
  }

  return result.data;
}
