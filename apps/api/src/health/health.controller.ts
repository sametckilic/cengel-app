import {
  Controller,
  Get,
  Header,
  Inject,
  ServiceUnavailableException,
} from '@nestjs/common';

import { DatabaseService } from '../database/database.service';

type HealthResponse = {
  checks: Record<string, 'down' | 'up'>;
  service: 'cengel-api';
  status: 'ok';
};

@Controller()
export class HealthController {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

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
  async getReadiness(): Promise<HealthResponse> {
    try {
      await this.database.ping();

      return {
        checks: { api: 'up', database: 'up' },
        service: 'cengel-api',
        status: 'ok',
      };
    } catch {
      throw new ServiceUnavailableException({
        checks: { api: 'up', database: 'down' },
        service: 'cengel-api',
        status: 'error',
      });
    }
  }
}
