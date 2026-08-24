import {
  isAchievementApiResponse,
  type AchievementApiResponse,
} from '@cengel/contracts/achievement-api';

import { getPuzzleApiOrigin } from '@/services/puzzle-catalog-client';

export async function fetchUserAchievements(
  accessToken: string,
): Promise<AchievementApiResponse> {
  const origin = getPuzzleApiOrigin();

  if (!origin) {
    throw new Error('Achievement API is not configured.');
  }

  const response = await fetch(
    new URL('v1/me/achievements', `${origin.replace(/\/$/, '')}/`).toString(),
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Achievement request failed with status ${response.status}.`);
  }

  const value: unknown = await response.json();

  if (!isAchievementApiResponse(value)) {
    throw new Error('Achievement API returned an invalid response.');
  }

  return value;
}
