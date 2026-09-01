import React, { useEffect, useRef } from 'react';
import userData from '@/controllers/userData';
import useAuth from '@/controllers/Authentication';

/**
 * Runs the session check + user-data (cart/wishlist/address) restore exactly
 * once per page load.
 *
 * A module-level flag prevents duplicate syncs across route transitions, but
 * router.refresh() bumps this generation counter so a full re-render (e.g.
 * after sign-in or sign-out) re-runs the sync — otherwise the one-shot guard
 * would serve stale pre-login state and the cart would appear lost.
 */
let sessionSyncGeneration = 0;

export function resetSessionSync() {
  sessionSyncGeneration += 1;
}

const Session = () => {
  const { checkSession } = useAuth();
  const { grabUserData } = userData();
  const hasRun = useRef(false);
  const generationAtMount = useRef(-1);

  useEffect(() => {
    if (hasRun.current && generationAtMount.current === sessionSyncGeneration) return;
    hasRun.current = true;
    generationAtMount.current = sessionSyncGeneration;

    async function sync() {
      try {
        await checkSession();
        await grabUserData();
      } catch (err) {
        // Non-blocking background session sync
      }
    }

    // Run non-blockingly after initial paint
    sync();
  }, [checkSession, grabUserData, sessionSyncGeneration]);

  return null;
};

export default Session;