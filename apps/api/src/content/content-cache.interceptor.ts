import { createHash } from 'node:crypto';

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { map, type Observable } from 'rxjs';

import type { AuthenticatedUser } from '../auth/authenticated-user';

@Injectable()
export class ContentCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { authenticatedUser?: AuthenticatedUser }>();
    const reply = context.switchToHttp().getResponse<FastifyReply>();

    return next.handle().pipe(
      map((body: unknown) => {
        const etag = `"${createHash('sha256')
          .update(JSON.stringify(body))
          .digest('base64url')}"`;
        reply.header(
          'Cache-Control',
          request.authenticatedUser
            ? 'private, max-age=300, stale-while-revalidate=86400'
            : 'public, max-age=300, stale-while-revalidate=86400',
        );
        reply.header('ETag', etag);
        reply.header('Vary', 'Authorization');

        if (request.headers['if-none-match'] === etag) {
          void reply.status(304).send();
          return undefined;
        }

        return body;
      }),
    );
  }
}
