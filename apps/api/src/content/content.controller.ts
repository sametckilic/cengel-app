import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseInterceptors,
} from '@nestjs/common';

import { ContentCacheInterceptor } from './content-cache.interceptor';
import { ContentService, type PuzzleSummary } from './content.service';

const API_VERSION = 1 as const;
const DIFFICULTIES = new Set<PuzzleSummary['difficulty']>([
  'beginner',
  'easy',
  'medium',
  'hard',
]);

export function getIstanbulDateKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
  }).format(date);
}

function parseDate(value: string | undefined): string {
  const date = value ?? getIstanbulDateKey();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) {
    throw new BadRequestException('date must use YYYY-MM-DD format.');
  }

  return date;
}

@Controller('v1/puzzles')
@UseInterceptors(ContentCacheInterceptor)
export class ContentController {
  constructor(private readonly content: ContentService) {}

  @Get()
  async list(
    @Query('category') category?: string,
    @Query('cursor') cursor?: string,
    @Query('difficulty') difficulty?: string,
    @Query('limit') rawLimit?: string,
  ) {
    const limit = rawLimit === undefined ? 20 : Number(rawLimit);

    if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
      throw new BadRequestException('limit must be an integer between 1 and 50.');
    }

    if (difficulty && !DIFFICULTIES.has(difficulty as PuzzleSummary['difficulty'])) {
      throw new BadRequestException('difficulty is invalid.');
    }

    try {
      const result = await this.content.list({
        category,
        cursor,
        difficulty: difficulty as PuzzleSummary['difficulty'] | undefined,
        limit,
        visibleOn: getIstanbulDateKey(),
      });

      return { apiVersion: API_VERSION, ...result };
    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid puzzle cursor.') {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('daily')
  async daily(@Query('date') rawDate?: string) {
    const date = parseDate(rawDate);

    if (date > getIstanbulDateKey()) {
      throw new BadRequestException('Future daily puzzles are not available.');
    }

    return { apiVersion: API_VERSION, ...(await this.content.findDaily(date)) };
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return {
      apiVersion: API_VERSION,
      ...(await this.content.findById(id, getIstanbulDateKey())),
    };
  }
}
