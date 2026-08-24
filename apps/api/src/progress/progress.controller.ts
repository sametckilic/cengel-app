import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { parseProgressSyncRequest } from './progress.dto';
import { ProgressService } from './progress.service';

@Controller('v1/progress')
@UseGuards(SupabaseAuthGuard)
export class ProgressController {
  constructor(private readonly progress: ProgressService) {}

  @Post('sync')
  async sync(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    return this.progress.sync(user, parseProgressSyncRequest(body));
  }
}
