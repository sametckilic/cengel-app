import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from './authenticated-user';
import { SupabaseTokenVerifier } from './supabase-token-verifier';

export type AuthenticatedRequest = FastifyRequest & {
  authenticatedUser: AuthenticatedUser;
};

export function parseBearerToken(authorization: string | undefined): string {
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? '');

  if (!match?.[1]) {
    throw new UnauthorizedException('A bearer access token is required.');
  }

  return match[1];
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly verifier: SupabaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { authenticatedUser?: AuthenticatedUser }>();
    const accessToken = parseBearerToken(request.headers.authorization);

    request.authenticatedUser = await this.verifier.verify(accessToken);
    return true;
  }
}

@Injectable()
export class OptionalSupabaseAuthGuard implements CanActivate {
  constructor(private readonly verifier: SupabaseTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<FastifyRequest & { authenticatedUser?: AuthenticatedUser }>();

    if (!request.headers.authorization) {
      return true;
    }

    const accessToken = parseBearerToken(request.headers.authorization);
    request.authenticatedUser = await this.verifier.verify(accessToken);
    return true;
  }
}
