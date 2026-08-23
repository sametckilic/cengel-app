import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';

type CreateApiApplicationOptions = Pick<NestApplicationOptions, 'logger'>;

export async function createApiApplication(
  options: CreateApiApplicationOptions = {},
): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    options,
  );

  app.enableShutdownHooks();

  return app;
}
