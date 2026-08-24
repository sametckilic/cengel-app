import {
  type PropsWithChildren,
  useEffect,
} from 'react';
import { AppState } from 'react-native';

import { subscribeProgressOutbox } from '@/services/progress-sync';
import { synchronizeProgress } from '@/services/progress-sync-client';
import { ensureAnonymousAccessToken } from '@/services/supabase-client';

const OUTBOX_DEBOUNCE_MS = 1500;

export function ProgressSyncProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    let active = true;
    let running = false;
    let rerunRequested = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function runSync() {
      if (!active) {
        return;
      }

      if (running) {
        rerunRequested = true;
        return;
      }

      running = true;

      try {
        const accessToken = await ensureAnonymousAccessToken();

        if (!accessToken) {
          return;
        }

        for (let batch = 0; batch < 10 && active; batch += 1) {
          const result = await synchronizeProgress(accessToken);

          if (result.status === 'unavailable' || result.sentEventCount < 50) {
            break;
          }
        }
      } catch {
        // The local outbox remains intact for the next foreground/network attempt.
      } finally {
        running = false;

        if (rerunRequested && active) {
          rerunRequested = false;
          scheduleSync(OUTBOX_DEBOUNCE_MS);
        }
      }
    }

    function scheduleSync(delay: number) {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => {
        timer = undefined;
        void runSync();
      }, delay);
    }

    const unsubscribeOutbox = subscribeProgressOutbox(() =>
      scheduleSync(OUTBOX_DEBOUNCE_MS),
    );
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleSync(0);
      }
    });
    scheduleSync(0);

    return () => {
      active = false;
      unsubscribeOutbox();
      appStateSubscription.remove();

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return children;
}
