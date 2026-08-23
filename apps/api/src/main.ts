import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';

import type { ApiEnvironment } from './config/environment';
import { createApiApplication } from './create-app';

async function bootstrap(): Promise<void> {
  const app = await createApiApplication();
  const config = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);

  await app.listen(config.get('PORT', { infer: true }), config.get('HOST', { infer: true }));
}

void bootstrap();
