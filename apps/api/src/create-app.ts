import type { NestApplicationOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import type { ApiEnvironment } from './config/environment';
import { ApiExceptionFilter } from './http/api-exception.filter';

type CreateApiApplicationOptions = Pick<NestApplicationOptions, 'logger'>;

export async function createApiApplication(
  options: CreateApiApplicationOptions = {},
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    options,
  );
  const config = app.get<ConfigService<ApiEnvironment, true>>(ConfigService);

  app.enableCors({
    exposedHeaders: ['ETag', 'X-Request-Id'],
    origin: config.get('CORS_ORIGINS', { infer: true }),
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.getHttpAdapter().getInstance().addHook('onRequest', (request, reply, done) => {
    reply.header('X-Request-Id', request.id);
    done();
  });

  app.enableShutdownHooks();

  return app;
}
