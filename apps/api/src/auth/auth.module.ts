import { Module } from '@nestjs/common';

import { SupabaseAuthGuard } from './supabase-auth.guard';
import { SupabaseTokenVerifier } from './supabase-token-verifier';

@Module({
  exports: [SupabaseAuthGuard, SupabaseTokenVerifier],
  providers: [SupabaseAuthGuard, SupabaseTokenVerifier],
})
export class AuthModule {}
