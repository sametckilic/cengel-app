import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AchievementsController } from './achievements.controller';
import { AchievementsService } from './achievements.service';

@Module({
  controllers: [AchievementsController],
  imports: [AuthModule],
  providers: [AchievementsService],
})
export class AchievementsModule {}
