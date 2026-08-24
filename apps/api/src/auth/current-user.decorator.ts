import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

import type { AuthenticatedUser } from './authenticated-user';
import type { AuthenticatedRequest } from './supabase-auth.guard';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>()
      .authenticatedUser;

    if (!user) {
      throw new UnauthorizedException('Authenticated user context is missing.');
    }

    return user;
  },
);
