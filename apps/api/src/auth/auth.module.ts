import { Module } from '@nestjs/common';

import {
  OptionalSupabaseAuthGuard,
  SupabaseAuthGuard,
} from './supabase-auth.guard';
import { SupabaseTokenVerifier } from './supabase-token-verifier';

@Module({
  exports: [OptionalSupabaseAuthGuard, SupabaseAuthGuard, SupabaseTokenVerifier],
  providers: [OptionalSupabaseAuthGuard, SupabaseAuthGuard, SupabaseTokenVerifier],
})
export class AuthModule {}
