import { describe, expect, it } from 'vitest';

import { shouldApplyProgressEvent } from '../src/progress/progress-conflict';

describe('progress conflict resolution', () => {
  it('accepts the first event and a newer client update', () => {
    expect(
      shouldApplyProgressEvent(null, {
        clientUpdatedAt: '2026-08-24T10:00:00.000Z',
        eventId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toBe(true);
    expect(
      shouldApplyProgressEvent(
        {
          clientUpdatedAt: '2026-08-24T10:00:00.000Z',
          eventId: '00000000-0000-4000-8000-000000000002',
        },
        {
          clientUpdatedAt: '2026-08-24T10:01:00.000Z',
          eventId: '00000000-0000-4000-8000-000000000001',
        },
      ),
    ).toBe(true);
  });

  it('rejects stale events and resolves timestamp ties by event id', () => {
    const current = {
      clientUpdatedAt: '2026-08-24T10:00:00.000Z',
      eventId: '00000000-0000-4000-8000-000000000002',
    };

    expect(
      shouldApplyProgressEvent(current, {
        clientUpdatedAt: '2026-08-24T09:59:00.000Z',
        eventId: '00000000-0000-4000-8000-000000000003',
      }),
    ).toBe(false);
    expect(
      shouldApplyProgressEvent(current, {
        clientUpdatedAt: current.clientUpdatedAt,
        eventId: '00000000-0000-4000-8000-000000000001',
      }),
    ).toBe(false);
    expect(
      shouldApplyProgressEvent(current, {
        clientUpdatedAt: current.clientUpdatedAt,
        eventId: '00000000-0000-4000-8000-000000000003',
      }),
    ).toBe(true);
  });
});
