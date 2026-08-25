import React, { useEffect, useRef } from 'react';
import userData from '@/controllers/userData';
import useAuth from '@/controllers/Authentication';

let globalSessionChecked = false;

const Session = () => {
  const { checkSession } = useAuth();
  const { grabUserData } = userData();
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current || globalSessionChecked) return;
    hasRun.current = true;
    globalSessionChecked = true;

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
  }, [checkSession, grabUserData]);

  return null;
};

export default Session;