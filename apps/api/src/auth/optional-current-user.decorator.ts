import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from './authenticated-user';
import type { AuthenticatedRequest } from './supabase-auth.guard';

export const OptionalCurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser | undefined =>
    context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>().authenticatedUser,
);
