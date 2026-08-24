import {
  type PropsWithChildren,
  useEffect,
} from 'react';
import { AppState } from 'react-native';

import { subscribeProgressOutbox } from '@/services/progress-sync';
import { synchronizeAuthenticatedProgress } from '@/services/progress-sync-client';
import { getAuthenticatedAccess, getSupabaseClient } from '@/services/supabase-client';

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
        const access = await getAuthenticatedAccess();

        if (!access) {
          return;
        }

        for (let batch = 0; batch < 10 && active; batch += 1) {
          const result = await synchronizeAuthenticatedProgress(access);

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
    const authSubscription = getSupabaseClient()?.auth.onAuthStateChange(() => scheduleSync(0));
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        scheduleSync(0);
      }
    });
    scheduleSync(0);

    return () => {
      active = false;
      unsubscribeOutbox();
      authSubscription?.data.subscription.unsubscribe();
      appStateSubscription.remove();

      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  return children;
}
