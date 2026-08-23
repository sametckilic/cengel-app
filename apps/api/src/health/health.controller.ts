import { Controller, Get, Header } from '@nestjs/common';

type HealthResponse = {
  checks: Record<string, 'up'>;
  service: 'cengel-api';
  status: 'ok';
};

@Controller()
export class HealthController {
  @Get('health')
  @Header('Cache-Control', 'no-store')
  getHealth(): HealthResponse {
    return {
      checks: { api: 'up' },
      service: 'cengel-api',
      status: 'ok',
    };
  }

  @Get('ready')
  @Header('Cache-Control', 'no-store')
  getReadiness(): HealthResponse {
    return {
      checks: { api: 'up' },
      service: 'cengel-api',
      status: 'ok',
    };
  }
}
