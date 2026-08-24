import type { ProgressSyncOutboxStore } from '@/services/progress-sync';
import {
  acknowledgeWebProgressEvents,
  getOrCreateWebProgressDeviceId,
  listWebProgressEvents,
} from '@/services/progress-sync-web-storage';

export const progressSyncOutboxStore: ProgressSyncOutboxStore = {
  async acknowledge(eventIds) {
    acknowledgeWebProgressEvents(eventIds);
  },
  async getDeviceId() {
    return getOrCreateWebProgressDeviceId();
  },
  async list(limit = 50) {
    return listWebProgressEvents(limit);
  },
};
