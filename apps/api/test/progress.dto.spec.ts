import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { parseProgressSyncRequest } from '../src/progress/progress.dto';

const deviceId = '00000000-0000-4000-8000-000000000001';

describe('progress sync request', () => {
  it('accepts a bounded event batch for one device', () => {
    expect(
      parseProgressSyncRequest({
        device: { id: deviceId, platform: 'ios' },
        events: [
          {
            clientUpdatedAt: '2026-08-24T10:00:00.000Z',
            deviceId,
            eventId: '00000000-0000-4000-8000-000000000002',
            operation: 'delete',
            puzzleId: 'example-puzzle',
          },
        ],
      }).events,
    ).toHaveLength(1);
  });

  it('rejects cross-device and duplicate events', () => {
    const event = {
      clientUpdatedAt: '2026-08-24T10:00:00.000Z',
      deviceId: '00000000-0000-4000-8000-000000000003',
      eventId: '00000000-0000-4000-8000-000000000002',
      operation: 'delete',
      puzzleId: 'example-puzzle',
    };

    expect(() =>
      parseProgressSyncRequest({
        device: { id: deviceId, platform: 'web' },
        events: [event, event],
      }),
    ).toThrow(BadRequestException);
  });
});
