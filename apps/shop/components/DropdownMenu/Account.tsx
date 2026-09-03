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
      <button className='mb-2 text-slate-700 hover:text-[#0D94FB] transition-colors p-1' aria-label="Account menu">
        <UserIcon width={32} height={32}/>
      </button>
      {isDropdownVisible && (
        <div id="dropdownAvatar" className="z-30 bg-white divide-y divide-gray-100 rounded-lg absolute right-0 drop-shadow-custom-xl w-48 border border-slate-100 py-1">
          <div className="px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 border-b border-slate-100">
            <div>{appState.loggedIn && userName ? userName : 'Customer Account'}</div>
          </div>
          <ul className="py-1 text-sm text-gray-700" aria-labelledby="dropdownUserAvatarButton">
            <li>
              <a href="/orders" className="block px-4 py-2 hover:bg-slate-50 text-slate-700">Track Orders</a>
            </li>
            <li>
              <a href="/cart-checkout" className="block px-4 py-2 hover:bg-slate-50 text-slate-700">Checkout</a>
            </li>
            <li>
              <a href="/account-settings" className="block px-4 py-2 hover:bg-slate-50 text-slate-700">Delivery Address</a>
            </li>
          </ul>
          {appState.loggedIn && (
            <div className="py-1">
              <button onClick={signOut} className="block px-4 w-full text-start py-2 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600">Sign out</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Account;
