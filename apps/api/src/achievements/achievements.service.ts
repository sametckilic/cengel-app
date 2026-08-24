import { Injectable } from '@nestjs/common';
import {
  ACHIEVEMENT_DEFINITIONS,
  type AchievementId,
  type AchievementVerification,
} from '@cengel/achievement-core';
import { eq } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { userAchievements } from '../database/schema';

type EarnedAchievementRow = {
  achievementId: string;
  earnedAt: Date;
  verification: AchievementVerification;
};

export function createAchievementList(earnedRows: readonly EarnedAchievementRow[]) {
  const earnedById = new Map(
    earnedRows.map((row) => [row.achievementId as AchievementId, row]),
  );

  return {
    apiVersion: 1 as const,
    items: ACHIEVEMENT_DEFINITIONS.map((definition) => {
      const earned = earnedById.get(definition.id);

      return {
        ...definition,
        earnedAt: earned?.earnedAt.toISOString() ?? null,
        verification: earned?.verification ?? null,
      };
    }),
  };
}

@Injectable()
export class AchievementsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string) {
    const rows = await this.database.db
      .select({
        achievementId: userAchievements.achievementId,
        earnedAt: userAchievements.earnedAt,
        verification: userAchievements.verification,
      })
      .from(userAchievements)
      .where(eq(userAchievements.userId, userId));

    return createAchievementList(rows);
  }
}
