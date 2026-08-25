import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';

import { RevenueCatWebhookService } from './revenuecat-webhook.service';

@Controller('v1/webhooks/revenuecat')
export class RevenueCatWebhookController {
  constructor(private readonly webhook: RevenueCatWebhookService) {}

  @Post()
  @HttpCode(200)
  async handle(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ) {
    return this.webhook.handle(authorization, body);
  }
}
