import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ContentController } from './content.controller';
import { ContentCacheInterceptor } from './content-cache.interceptor';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController],
  imports: [AuthModule],
  providers: [ContentCacheInterceptor, ContentService],
})
export class ContentModule {}
