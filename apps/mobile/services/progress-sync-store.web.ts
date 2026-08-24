import type { ProgressSyncOutboxStore } from '@/services/progress-sync';
import { applyRemoteProgressChanges } from '@/services/puzzle-progress-store';
import {
  acknowledgeWebProgressEvents,
  getOrCreateWebProgressDeviceId,
  listWebProgressEvents,
} from '@/services/progress-sync-web-storage';

export const progressSyncOutboxStore: ProgressSyncOutboxStore = {
  async acknowledge(eventIds) {
    acknowledgeWebProgressEvents(eventIds);
  },
  async applyChanges(changes) {
    await applyRemoteProgressChanges(changes);
  },
  async getDeviceId() {
    return getOrCreateWebProgressDeviceId();
  },
  async list(limit = 50) {
    return listWebProgressEvents(limit);
  },
};
