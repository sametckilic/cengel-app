import { Controller, Get, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { AchievementsService } from './achievements.service';

@Controller('v1/me/achievements')
@UseGuards(SupabaseAuthGuard)
export class AchievementsController {
  constructor(private readonly achievements: AchievementsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    return this.achievements.list(user.userId);
  }
}
