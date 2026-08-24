import { describe, expect, it, vi } from 'vitest';

import { AchievementsController } from '../src/achievements/achievements.controller';
import {
  AchievementsService,
  createAchievementList,
} from '../src/achievements/achievements.service';

describe('achievements', () => {
  it('returns every definition in stable order with earned state', () => {
    const response = createAchievementList([
      {
        achievementId: 'first-completion',
        earnedAt: new Date('2026-08-24T12:00:00.000Z'),
        verification: 'casual',
      },
    ]);

    expect(response.items.map(({ id }) => id)).toEqual([
      'first-completion',
      'no-hint-completion',
      'daily-streak-3',
      'daily-streak-7',
    ]);
    expect(response.items[0]).toMatchObject({
      earnedAt: '2026-08-24T12:00:00.000Z',
      verification: 'casual',
    });
    expect(response.items[1]).toMatchObject({ earnedAt: null, verification: null });
  });

  it('loads achievements for the authenticated user', async () => {
    const list = vi.fn().mockResolvedValue({ apiVersion: 1, items: [] });
    const service = { list } as unknown as AchievementsService;
    const controller = new AchievementsController(service);

    await controller.list({
      isAnonymous: false,
      userId: '00000000-0000-4000-8000-000000000001',
    });

    expect(list).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
  });
});
