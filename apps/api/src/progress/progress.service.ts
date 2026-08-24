import { ConflictException, Injectable } from '@nestjs/common';
import { ACHIEVEMENT_DEFINITIONS } from '@cengel/achievement-core';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { DatabaseService } from '../database/database.service';
import {
  achievementDefinitions,
  devices,
  profiles,
  progressEvents,
  puzzlePublications,
  puzzles,
  userAchievements,
  userPuzzleProgress,
} from '../database/schema';
import { evaluateProgressAchievements } from './achievement-evaluation';
import type { ProgressSyncRequest } from './progress.dto';
import { shouldApplyProgressEvent } from './progress-conflict';

export type ProgressSyncResult = {
  acknowledgedEventIds: readonly string[];
  changes: readonly {
    clientUpdatedAt: string;
    deleted: boolean;
    deviceId: string;
    puzzleId: string;
    serverVersion: number;
    snapshot: Record<string, unknown> | null;
    sourceEventId: string;
  }[];
};

@Injectable()
export class ProgressService {
  constructor(private readonly database: DatabaseService) {}

  async sync(
    user: AuthenticatedUser,
    request: ProgressSyncRequest,
  ): Promise<ProgressSyncResult> {
    return this.database.db.transaction(async (transaction) => {
      await transaction.execute(
        sql`SELECT pg_advisory_xact_lock(hashtext(${user.userId}))`,
      );
      const now = new Date();

      await transaction
        .insert(profiles)
        .values({ userId: user.userId })
        .onConflictDoUpdate({
          set: { updatedAt: now },
          target: profiles.userId,
        });
      await transaction
        .insert(devices)
        .values({
          id: request.device.id,
          platform: request.device.platform,
          userId: user.userId,
        })
        .onConflictDoNothing();
      const [storedDevice] = await transaction
        .select({ userId: devices.userId })
        .from(devices)
        .where(eq(devices.id, request.device.id))
        .limit(1);

      if (storedDevice?.userId !== user.userId) {
        throw new ConflictException('Device is already linked to another user.');
      }

      await transaction
        .update(devices)
        .set({ lastSeenAt: now, platform: request.device.platform })
        .where(eq(devices.id, request.device.id));

      const acknowledgedEventIds: string[] = [];

      for (const event of request.events) {
        const inserted = await transaction
          .insert(progressEvents)
          .values({
            clientUpdatedAt: new Date(event.clientUpdatedAt),
            deviceId: event.deviceId,
            eventId: event.eventId,
            operation: event.operation,
            puzzleId: event.puzzleId,
            snapshot: event.operation === 'upsert' ? event.snapshot : null,
            userId: user.userId,
          })
          .onConflictDoNothing()
          .returning({ eventId: progressEvents.eventId });

        if (inserted.length === 0) {
          const [existingEvent] = await transaction
            .select({
              deviceId: progressEvents.deviceId,
              puzzleId: progressEvents.puzzleId,
              userId: progressEvents.userId,
            })
            .from(progressEvents)
            .where(eq(progressEvents.eventId, event.eventId))
            .limit(1);

          if (
            existingEvent?.userId !== user.userId ||
            existingEvent.deviceId !== event.deviceId ||
            existingEvent.puzzleId !== event.puzzleId
          ) {
            throw new ConflictException('Event id is already used by another event.');
          }

          acknowledgedEventIds.push(event.eventId);
          continue;
        }

        const [current] = await transaction
          .select({
            clientUpdatedAt: userPuzzleProgress.clientUpdatedAt,
            serverVersion: userPuzzleProgress.serverVersion,
            sourceEventId: userPuzzleProgress.sourceEventId,
          })
          .from(userPuzzleProgress)
          .where(
            and(
              eq(userPuzzleProgress.userId, user.userId),
              eq(userPuzzleProgress.puzzleId, event.puzzleId),
            ),
          )
          .limit(1);
        const applies = shouldApplyProgressEvent(
          current
            ? {
                clientUpdatedAt: current.clientUpdatedAt.toISOString(),
                eventId: current.sourceEventId,
              }
            : null,
          {
            clientUpdatedAt: event.clientUpdatedAt,
            eventId: event.eventId,
          },
        );

        if (applies) {
          const state = {
            clientUpdatedAt: new Date(event.clientUpdatedAt),
            deleted: event.operation === 'delete',
            deviceId: event.deviceId,
            serverVersion: (current?.serverVersion ?? 0) + 1,
            snapshot: event.operation === 'upsert' ? event.snapshot : null,
            sourceEventId: event.eventId,
            updatedAt: now,
          };

          await transaction
            .insert(userPuzzleProgress)
            .values({
              ...state,
              puzzleId: event.puzzleId,
              userId: user.userId,
            })
            .onConflictDoUpdate({
              set: state,
              target: [userPuzzleProgress.userId, userPuzzleProgress.puzzleId],
            });
        }

        acknowledgedEventIds.push(event.eventId);
      }

      const states = await transaction
        .select({
          clientUpdatedAt: userPuzzleProgress.clientUpdatedAt,
          deleted: userPuzzleProgress.deleted,
          deviceId: userPuzzleProgress.deviceId,
          puzzleId: userPuzzleProgress.puzzleId,
          serverVersion: userPuzzleProgress.serverVersion,
          snapshot: userPuzzleProgress.snapshot,
          sourceEventId: userPuzzleProgress.sourceEventId,
        })
        .from(userPuzzleProgress)
        .where(eq(userPuzzleProgress.userId, user.userId));

      const puzzleIds = states
        .filter(({ deleted }) => !deleted)
        .map(({ puzzleId }) => puzzleId);
      const puzzleRecords =
        puzzleIds.length === 0
          ? []
          : await transaction
              .select({
                definition: puzzles.definition,
                id: puzzles.id,
                validationMode: puzzles.validationMode,
                version: puzzles.version,
              })
              .from(puzzles)
              .innerJoin(
                puzzlePublications,
                eq(puzzlePublications.puzzleRecordId, puzzles.recordId),
              )
              .where(
                and(
                  inArray(puzzles.id, puzzleIds),
                  eq(puzzles.qualityPassed, true),
                  eq(puzzlePublications.status, 'published'),
                ),
              )
              .orderBy(desc(puzzles.version));
      const earnedAchievements = evaluateProgressAchievements(states, puzzleRecords);

      for (const definition of ACHIEVEMENT_DEFINITIONS) {
        await transaction
          .insert(achievementDefinitions)
          .values(definition)
          .onConflictDoUpdate({
            set: {
              description: definition.description,
              target: definition.target,
              title: definition.title,
              type: definition.type,
            },
            target: achievementDefinitions.id,
          });
      }

      if (earnedAchievements.length > 0) {
        await transaction
          .insert(userAchievements)
          .values(
            earnedAchievements.map((achievement) => ({
              achievementId: achievement.achievementId,
              earnedAt: new Date(achievement.earnedAt),
              evidence: {
                evaluatorVersion: 1,
                puzzleIds: achievement.evidencePuzzleIds,
              },
              userId: user.userId,
              verification: achievement.verification,
            })),
          )
          .onConflictDoNothing();
      }

      return {
        acknowledgedEventIds,
        changes: states.map((state) => ({
          ...state,
          clientUpdatedAt: state.clientUpdatedAt.toISOString(),
        })),
      };
    });
  }
}
