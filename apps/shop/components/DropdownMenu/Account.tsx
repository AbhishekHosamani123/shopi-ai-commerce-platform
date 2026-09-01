import React, { useState } from 'react';
import { UserIcon } from '@heroicons/react/24/outline';
import { useApp } from '@/Helpers/AccountDialog';
import { useAppSelector } from '@/app/hooks';
import signOutHandler from '@/app/api/signout';
import { resetSessionSync } from '@/components/Session';
import { useRouter } from 'next/navigation';
const Account = () => {
  const [isDropdownVisible, setDropdownVisible] = useState(false);
  const { appState } = useApp();
  const router = useRouter();
  const userName = useAppSelector((state)=>state.userState.defaultAccount.userName);
  async function signOut(){
    // Await the server-side cookie clear so the session is actually gone
    // before navigating — otherwise the next page may still see the session
    // and "signed-out" users appear logged in.
    await signOutHandler();
    // Force the session sync to re-run so the UI reflects the signed-out
    // state (the one-shot guard in Session.tsx would otherwise keep the
    // pre-signout authenticated state).
    resetSessionSync();
    router.push('/signed-out');
    router.refresh();
  }
  return (
    <div onMouseEnter={()=>setDropdownVisible(true)} onMouseLeave={()=>setDropdownVisible(false)} className="relative mx-auto my-auto">
      {appState.loggedIn ? (
        <button className='mb-2' aria-label="Account menu">
          <UserIcon width={40}/>
        </button>
      ) : (
        /* Persistent, clearly visible Sign In entry — previously Sign In was
           buried inside a hover-only dropdown, making it easy to miss. */
        <a
          href="/sign-in"
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors"
          aria-label="Sign in to your account"
        >
          <UserIcon width={20} height={20} />
          <span className="hidden sm:inline">Sign In</span>
        </a>
      )}
      {(isDropdownVisible && appState.loggedIn) && (
        <div id="dropdownAvatar" className="z-30 bg-white divide-y divide-gray-100 rounded-lg absolute drop-shadow-custom-xl w-44">
          <div className="px-4 py-3 text-sm text-gray-500 ">
            <div>{userName}</div>
          </div>
          <ul className="py-2 text-sm text-gray-700 dark:text-gray-200" aria-labelledby="dropdownUserAvatarButton">
            <li>
              <a href="/account-settings" className="block px-4 py-2 hover:bg-gray-100 text-gray-500">Settings</a>
            </li>
            <li>
              <a href="/orders" className="block px-4 py-2 hover:bg-gray-100 text-gray-500">Orders</a>
            </li>
          </ul>
          <div className="py-2">
            <button onClick={signOut} className="block px-4 w-full text-start py-2 text-sm text-gray-400 hover:bg-gray-100">Sign out</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
