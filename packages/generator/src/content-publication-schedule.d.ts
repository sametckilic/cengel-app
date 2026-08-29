import type {
  DailyPuzzlePublication,
  GeneratorClueCatalog,
} from './daily-puzzle-schedule';

export type ContentPuzzleProfile = {
  categories: readonly string[];
  categoryWeight: number;
  columnCount: number;
  difficulty: 'beginner' | 'easy' | 'medium' | 'hard';
  generatorVersion: 'newspaper-v2';
  rowCount: number;
  targetWordCount: number;
};

type BaseContentPublicationPlanItem = {
  profile: ContentPuzzleProfile;
  profileId: string;
  publicationDate: string;
  puzzleId: string;
  revision: string;
  seed: string;
  title: string;
};

export type ContentPublicationPlanItem = BaseContentPublicationPlanItem &
  (
    | { channel: 'archive' }
    | {
        channel: 'pack';
        packId: string;
        puzzleNumber: number;
      }
  );

export const CONTENT_PLAN_REVISION: 'content-v1';
export const CONTENT_PUBLICATION_PLAN: readonly ContentPublicationPlanItem[];
export const CONTENT_RELEASE_DATE: '2026-08-29';
export const DEFAULT_MAX_ATTEMPTS: 5;

export function createScheduledContentPublication(
  catalog: GeneratorClueCatalog,
  item: ContentPublicationPlanItem,
): DailyPuzzlePublication;
