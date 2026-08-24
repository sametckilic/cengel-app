import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DATABASE_URL: z.url().refine(
    (value) => value.startsWith('postgres://') || value.startsWith('postgresql://'),
    'DATABASE_URL must use the postgres or postgresql protocol.',
  ),
  DB_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
  WORKER_BUFFER_DAYS: z.coerce.number().int().min(1).max(31).default(7),
  WORKER_MODE: z.enum(['publish', 'shadow']).default('shadow'),
  WORKER_REVISION: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .default('schedule-v1'),
  WORKER_START_DATE: z
    .union([z.literal('today'), z.literal('tomorrow'), z.iso.date()])
    .default('tomorrow'),
});

export type WorkerEnvironment = z.infer<typeof environmentSchema>;

export function validateWorkerEnvironment(
  environment: NodeJS.ProcessEnv,
): WorkerEnvironment {
  const result = environmentSchema.safeParse(environment);

  if (!result.success) {
    throw new Error(`Invalid worker configuration:\n${z.prettifyError(result.error)}`);
  }

  return result.data;
}
