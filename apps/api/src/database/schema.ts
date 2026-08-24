import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const gameplayDifficulty = pgEnum('gameplay_difficulty', [
  'beginner',
  'easy',
  'medium',
  'hard',
]);

export const puzzleValidationMode = pgEnum('puzzle_validation_mode', [
  'offline-casual',
  'server-verified',
]);

export const publicationStatus = pgEnum('publication_status', [
  'draft',
  'published',
  'retired',
]);

export const generationRunStatus = pgEnum('generation_run_status', [
  'queued',
  'running',
  'succeeded',
  'failed',
]);

export const progressOperation = pgEnum('progress_operation', [
  'delete',
  'upsert',
]);

export const achievementVerification = pgEnum('achievement_verification', [
  'casual',
  'verified',
]);

export const profiles = pgTable('profiles', {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  userId: uuid('user_id').primaryKey(),
});

export const achievementDefinitions = pgTable(
  'achievement_definitions',
  {
    description: text('description').notNull(),
    id: text('id').primaryKey(),
    target: integer('target').notNull(),
    title: text('title').notNull(),
    type: text('type').notNull(),
  },
  (table) => [check('achievement_definitions_target_positive', sql`${table.target} > 0`)],
);

export const userAchievements = pgTable(
  'user_achievements',
  {
    achievementId: text('achievement_id')
      .notNull()
      .references(() => achievementDefinitions.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull(),
    evidence: jsonb('evidence').$type<Record<string, unknown>>().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
    verification: achievementVerification('verification').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.achievementId] }),
    index('user_achievements_earned_idx').on(table.userId, table.earnedAt),
  ],
);

export const devices = pgTable(
  'devices',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    id: uuid('id').primaryKey(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    platform: text('platform').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
  },
  (table) => [index('devices_user_id_idx').on(table.userId)],
);

export const progressEvents = pgTable(
  'progress_events',
  {
    clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id').primaryKey(),
    operation: progressOperation('operation').notNull(),
    puzzleId: text('puzzle_id').notNull(),
    receivedAt: timestamp('received_at', { withTimezone: true }).defaultNow().notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
  },
  (table) => [
    index('progress_events_user_received_idx').on(table.userId, table.receivedAt),
    index('progress_events_puzzle_idx').on(table.userId, table.puzzleId),
    check(
      'progress_events_snapshot_operation',
      sql`(${table.operation} = 'upsert' AND ${table.snapshot} IS NOT NULL) OR (${table.operation} = 'delete' AND ${table.snapshot} IS NULL)`,
    ),
  ],
);

export const userPuzzleProgress = pgTable(
  'user_puzzle_progress',
  {
    clientUpdatedAt: timestamp('client_updated_at', { withTimezone: true }).notNull(),
    deleted: boolean('deleted').default(false).notNull(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id, { onDelete: 'restrict' }),
    puzzleId: text('puzzle_id').notNull(),
    serverVersion: integer('server_version').default(1).notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
    sourceEventId: uuid('source_event_id')
      .notNull()
      .references(() => progressEvents.eventId, { onDelete: 'restrict' }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.userId, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.puzzleId] }),
    index('user_puzzle_progress_updated_idx').on(table.userId, table.updatedAt),
    check('user_puzzle_progress_version_positive', sql`${table.serverVersion} > 0`),
    check(
      'user_puzzle_progress_snapshot_deleted',
      sql`(${table.deleted} = false AND ${table.snapshot} IS NOT NULL) OR (${table.deleted} = true AND ${table.snapshot} IS NULL)`,
    ),
  ],
);

export const clueCatalogVersions = pgTable('clue_catalog_versions', {
  checksum: text('checksum').notNull().unique(),
  confirmedAt: date('confirmed_at', { mode: 'string' }).notNull(),
  id: text('id').primaryKey(),
  importedAt: timestamp('imported_at', { withTimezone: true }).defaultNow().notNull(),
  rightsBasis: text('rights_basis').notNull(),
  sourceFile: text('source_file').notNull(),
});

export const clues = pgTable(
  'clues',
  {
    answer: text('answer').notNull(),
    answerLength: integer('answer_length').notNull(),
    catalogVersionId: text('catalog_version_id')
      .notNull()
      .references(() => clueCatalogVersions.id, { onDelete: 'restrict' }),
    category: text('category').notNull(),
    clue: text('clue').notNull(),
    difficulty: gameplayDifficulty('difficulty').notNull(),
    fallbackOnly: boolean('fallback_only').default(false).notNull(),
    id: text('id').notNull(),
    kind: text('kind').notNull(),
    shortClue: text('short_clue').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.catalogVersionId, table.id] }),
    index('clues_catalog_version_idx').on(table.catalogVersionId),
    index('clues_generation_filter_idx').on(
      table.difficulty,
      table.category,
      table.answerLength,
    ),
    check('clues_answer_length_positive', sql`${table.answerLength} > 0`),
  ],
);

export const puzzles = pgTable(
  'puzzles',
  {
    catalogVersionId: text('catalog_version_id')
      .notNull()
      .references(() => clueCatalogVersions.id, { onDelete: 'restrict' }),
    categories: text('categories').array().notNull(),
    checksum: text('checksum').notNull(),
    columnCount: integer('column_count').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    definition: jsonb('definition').$type<Record<string, unknown>>().notNull(),
    difficulty: gameplayDifficulty('difficulty').notNull(),
    id: text('id').notNull(),
    qualityPassed: boolean('quality_passed').default(false).notNull(),
    recordId: uuid('record_id').defaultRandom().primaryKey(),
    rowCount: integer('row_count').notNull(),
    title: text('title').notNull(),
    validationMode: puzzleValidationMode('validation_mode')
      .default('offline-casual')
      .notNull(),
    version: integer('version').default(1).notNull(),
  },
  (table) => [
    uniqueIndex('puzzles_id_version_unique').on(table.id, table.version),
    uniqueIndex('puzzles_checksum_unique').on(table.checksum),
    index('puzzles_catalog_version_idx').on(table.catalogVersionId),
    index('puzzles_catalog_filter_idx').on(table.difficulty, table.createdAt),
    check('puzzles_version_positive', sql`${table.version} > 0`),
    check(
      'puzzles_dimensions_positive',
      sql`${table.rowCount} > 0 AND ${table.columnCount} > 0`,
    ),
  ],
);

export const puzzlePublications = pgTable(
  'puzzle_publications',
  {
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    id: uuid('id').defaultRandom().primaryKey(),
    publicationDate: date('publication_date', { mode: 'string' }).notNull(),
    publicationKey: text('publication_key').default('daily').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    puzzleRecordId: uuid('puzzle_record_id')
      .notNull()
      .references(() => puzzles.recordId, { onDelete: 'restrict' }),
    requiredEntitlement: text('required_entitlement'),
    status: publicationStatus('status').default('draft').notNull(),
    timezone: text('timezone').default('Europe/Istanbul').notNull(),
  },
  (table) => [
    uniqueIndex('puzzle_publications_active_date_unique')
      .on(table.publicationDate, table.publicationKey)
      .where(sql`${table.status} = 'published'`),
    index('puzzle_publications_puzzle_idx').on(table.puzzleRecordId),
    index('puzzle_publications_visible_idx').on(
      table.status,
      table.publicationDate,
    ),
    check(
      'puzzle_publications_published_at_required',
      sql`${table.status} <> 'published' OR ${table.publishedAt} IS NOT NULL`,
    ),
  ],
);

export const generationRuns = pgTable(
  'generation_runs',
  {
    catalogVersionId: text('catalog_version_id')
      .notNull()
      .references(() => clueCatalogVersions.id, { onDelete: 'restrict' }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    error: text('error'),
    id: uuid('id').defaultRandom().primaryKey(),
    profileId: text('profile_id').notNull(),
    publicationDate: date('publication_date', { mode: 'string' }).notNull(),
    qualityReport: jsonb('quality_report').$type<Record<string, unknown>>(),
    requestHash: text('request_hash').notNull().unique(),
    revision: text('revision').notNull(),
    seed: text('seed').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    status: generationRunStatus('status').default('queued').notNull(),
  },
  (table) => [
    index('generation_runs_publication_date_idx').on(table.publicationDate),
    index('generation_runs_status_idx').on(table.status, table.createdAt),
  ],
);
