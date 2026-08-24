import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const turkishLetterSchema = z.string().regex(/^[A-ZÇĞİÖŞÜ]$/);
const progressSnapshotSchema = z.object({
  entries: z.record(z.string().regex(/^\d+$/), turkishLetterSchema),
  puzzleId: z.string().min(1),
  revealedWordIds: z.array(z.string().min(1)),
  schemaVersion: z.literal(1),
  selection: z.object({
    cellIndex: z.number().int().nonnegative(),
    wordId: z.string().min(1),
  }),
  solvedWordIds: z.array(z.string().min(1)),
  updatedAt: z.iso.datetime(),
});
const eventBaseSchema = z.object({
  clientUpdatedAt: z.iso.datetime(),
  deviceId: z.uuid(),
  eventId: z.uuid(),
  puzzleId: z.string().min(1),
});
const progressEventSchema = z.discriminatedUnion('operation', [
  eventBaseSchema.extend({ operation: z.literal('delete') }),
  eventBaseSchema
    .extend({
      operation: z.literal('upsert'),
      snapshot: progressSnapshotSchema,
    })
    .superRefine((event, context) => {
      if (event.snapshot.puzzleId !== event.puzzleId) {
        context.addIssue({
          code: 'custom',
          message: 'snapshot puzzleId must match event puzzleId.',
          path: ['snapshot', 'puzzleId'],
        });
      }

      if (event.snapshot.updatedAt !== event.clientUpdatedAt) {
        context.addIssue({
          code: 'custom',
          message: 'snapshot updatedAt must match event clientUpdatedAt.',
          path: ['snapshot', 'updatedAt'],
        });
      }
    }),
]);
const progressSyncRequestSchema = z
  .object({
    device: z.object({
      id: z.uuid(),
      platform: z.enum(['android', 'ios', 'web']),
    }),
    events: z.array(progressEventSchema).max(50),
  })
  .superRefine((request, context) => {
    const eventIds = new Set<string>();

    request.events.forEach((event, index) => {
      if (event.deviceId !== request.device.id) {
        context.addIssue({
          code: 'custom',
          message: 'event deviceId must match request device id.',
          path: ['events', index, 'deviceId'],
        });
      }

      if (eventIds.has(event.eventId)) {
        context.addIssue({
          code: 'custom',
          message: 'eventId values must be unique within a batch.',
          path: ['events', index, 'eventId'],
        });
      }

      eventIds.add(event.eventId);
    });
  });

export type ProgressSyncRequest = z.infer<typeof progressSyncRequestSchema>;

export function parseProgressSyncRequest(value: unknown): ProgressSyncRequest {
  const result = progressSyncRequestSchema.safeParse(value);

  if (!result.success) {
    throw new BadRequestException(
      `Invalid progress sync request: ${z.prettifyError(result.error)}`,
    );
  }

  return result.data;
}
