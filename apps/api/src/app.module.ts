import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AchievementsModule } from './achievements/achievements.module';
import { AuthModule } from './auth/auth.module';
import { validateEnvironment } from './config/environment';
import { ContentModule } from './content/content.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { ProgressModule } from './progress/progress.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: validateEnvironment,
    }),
    AchievementsModule,
    DatabaseModule,
    AuthModule,
    ContentModule,
    HealthModule,
    ProgressModule,
  ],
})
export class AppModule {}
