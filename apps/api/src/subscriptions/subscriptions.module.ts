import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { RevenueCatWebhookController } from './revenuecat-webhook.controller';
import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Module({
  controllers: [EntitlementsController, RevenueCatWebhookController],
  imports: [AuthModule],
  providers: [EntitlementsService, RevenueCatWebhookService],
})
export class SubscriptionsModule {}
