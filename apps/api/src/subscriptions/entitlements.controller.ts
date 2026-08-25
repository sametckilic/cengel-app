import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { EntitlementsService } from './entitlements.service';

@Controller('v1/me/entitlements')
@UseGuards(SupabaseAuthGuard)
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.entitlements.list(user.userId);
  }
}
