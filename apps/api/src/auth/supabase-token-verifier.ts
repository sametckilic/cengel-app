import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import type { ApiEnvironment } from '../config/environment';
import type { AuthenticatedUser } from './authenticated-user';

const userIdSchema = z.uuid();

@Injectable()
export class SupabaseTokenVerifier {
  private readonly issuer: string | undefined;
  private readonly keySet: JWTVerifyGetKey | undefined;

  constructor(config: ConfigService<ApiEnvironment, true>) {
    const projectUrl = config.get('SUPABASE_URL', { infer: true })?.replace(
      /\/$/,
      '',
    );

    if (projectUrl) {
      this.issuer = `${projectUrl}/auth/v1`;
      this.keySet = createRemoteJWKSet(
        new URL(`${this.issuer}/.well-known/jwks.json`),
      );
    }
  }

  async verify(accessToken: string): Promise<AuthenticatedUser> {
    if (!this.issuer || !this.keySet) {
      throw new ServiceUnavailableException(
        'User authentication is not configured.',
      );
    }

    try {
      const { payload } = await jwtVerify(accessToken, this.keySet, {
        audience: 'authenticated',
        issuer: this.issuer,
      });
      const userId = userIdSchema.safeParse(payload.sub);

      if (!userId.success || payload.role !== 'authenticated') {
        throw new UnauthorizedException('Access token claims are invalid.');
      }

      return {
        isAnonymous: payload.is_anonymous === true,
        userId: userId.data,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Access token is invalid or expired.');
    }
  }
}
