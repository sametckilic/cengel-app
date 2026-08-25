import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import {
  OptionalSupabaseAuthGuard,
  parseBearerToken,
} from '../src/auth/supabase-auth.guard';
import type { SupabaseTokenVerifier } from '../src/auth/supabase-token-verifier';

function createContext(authorization?: string) {
  const request = { headers: { authorization } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as ExecutionContext;

  return { context, request };
}

describe('Supabase auth guard', () => {
  it('extracts a case-insensitive bearer token', () => {
    expect(parseBearerToken('bearer header.payload.signature')).toBe(
      'header.payload.signature',
    );
  });

  it('rejects missing and malformed authorization headers', () => {
    expect(() => parseBearerToken(undefined)).toThrow(UnauthorizedException);
    expect(() => parseBearerToken('Basic credentials')).toThrow(
      UnauthorizedException,
    );
    expect(() => parseBearerToken('Bearer token with spaces')).toThrow(
      UnauthorizedException,
    );
  });

  it('allows anonymous content requests without invoking token verification', async () => {
    const verify = vi.fn();
    const guard = new OptionalSupabaseAuthGuard({ verify } as unknown as SupabaseTokenVerifier);
    const { context } = createContext();

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it('attaches the verified user to authenticated content requests', async () => {
    const user = { isAnonymous: false, userId: '00000000-0000-4000-8000-000000000001' };
    const verify = vi.fn().mockResolvedValue(user);
    const guard = new OptionalSupabaseAuthGuard({ verify } as unknown as SupabaseTokenVerifier);
    const { context, request } = createContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(verify).toHaveBeenCalledWith('valid-token');
    expect(request).toHaveProperty('authenticatedUser', user);
  });
});
