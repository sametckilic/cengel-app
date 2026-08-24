import { UnauthorizedException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseBearerToken } from '../src/auth/supabase-auth.guard';

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
});
