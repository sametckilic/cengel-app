import { z } from 'zod';

const environmentSchema = z.object({
  HOST: z.string().min(1).default('0.0.0.0'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
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
