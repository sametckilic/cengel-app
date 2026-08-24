export const ACHIEVEMENT_API_VERSION = 1 as const;

export type AchievementApiItem = {
  description: string;
  earnedAt: string | null;
  id:
    | 'daily-streak-3'
    | 'daily-streak-7'
    | 'first-completion'
    | 'no-hint-completion';
  target: number;
  title: string;
  type: 'completion' | 'daily-streak' | 'no-hint-completion';
  verification: 'casual' | 'verified' | null;
};

export type AchievementApiResponse = {
  apiVersion: typeof ACHIEVEMENT_API_VERSION;
  items: readonly AchievementApiItem[];
};

const ACHIEVEMENT_IDS = new Set<AchievementApiItem['id']>([
  'daily-streak-3',
  'daily-streak-7',
  'first-completion',
  'no-hint-completion',
]);
const ACHIEVEMENT_TYPES = new Set<AchievementApiItem['type']>([
  'completion',
  'daily-streak',
  'no-hint-completion',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isAchievementApiResponse(value: unknown): value is AchievementApiResponse {
  return (
    isRecord(value) &&
    value.apiVersion === ACHIEVEMENT_API_VERSION &&
    Array.isArray(value.items) &&
    value.items.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        ACHIEVEMENT_IDS.has(item.id as AchievementApiItem['id']) &&
        typeof item.title === 'string' &&
        typeof item.description === 'string' &&
        typeof item.type === 'string' &&
        ACHIEVEMENT_TYPES.has(item.type as AchievementApiItem['type']) &&
        Number.isInteger(item.target) &&
        Number(item.target) > 0 &&
        (item.earnedAt === null ||
          (typeof item.earnedAt === 'string' && !Number.isNaN(Date.parse(item.earnedAt)))) &&
        (item.verification === null ||
          item.verification === 'casual' ||
          item.verification === 'verified'),
    ) &&
    new Set(value.items.map((item) => (item as Record<string, unknown>).id)).size ===
      value.items.length
  );
}
