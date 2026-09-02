import { useApp } from "@/Helpers/AccountDialog";
import { useRouter } from 'next/navigation';
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { setDefaultAccount } from "@/features/UIUpdates/UserAccount";
import { setCart } from "@/features/UIUpdates/CartWishlist";
import signInHandler from '@/app/api/signin';
import signUpHandler from '@/app/api/signup';
import sessionHandler from "@/app/api/sessionauth";
import userData from "@/controllers/userData";
import { cartAddHandler } from "@/app/api/itemLists";
import authDataHandler from "@/app/api/googleAuth";
const useAuth = () => {
  const { toggleLoggedIn, toggleIsIncorrect, toggleIsExists, toggleServerError, setLoggedIn, toggleSignupSuccess } = useApp();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const guestCart = useAppSelector((state) => state.cartWishlist.cart);
  const { grabUserData } = userData();

  /**
   * Post-login cart synchronisation.
   *
   * Root cause of the "cart disappears after login" bug: items added before
   * login lived only in Redux (the backend insert is skipped for guests), and
   * after login NOTHING re-synced the user's server cart — the page-load-only
   * Session.tsx guard had already run. This merges the guest cart into the
   * freshly authenticated user's server cart and then restores the merged
   * state so checkout sees everything.
   */
  const syncCartAfterLogin = async (userID: number) => {
    try {
      // 1. Push each guest cart item to the user's server cart.
      for (const item of guestCart) {
        try {
          await cartAddHandler({
            cartItemID: item.cartItemID,
            userID,
            productID: item.productID,
            productPrice: item.productPrice,
            colorID: 1,
            sizeID: 1,
            quantity: item.quantity,
          });
        } catch {
          // A single failed merge item must not block the rest.
        }
      }

      // 2. Pull the authoritative merged cart (server) back into Redux so
      // the UI reflects both old and new items with real cartItemIDs.
      // NOTE: use the already-instantiated grabUserData from the destructured
      // userData() hook above — calling userData() HERE would re-invoke React
      // hooks (useAppDispatch) inside a nested async function, violating the
      // hooks rules and throwing at runtime, which previously aborted the
      // login redirect entirely.
      const res = await grabUserData();
      return !!res?.success;
    } catch {
      return false;
    }
  };

  const checkLogin = async (form: { email: string; password: string }, remember: boolean,setloading:React.Dispatch<React.SetStateAction<boolean>>) => {
    // Backend returns 503 + {recovering:true} when Render's free Postgres was
    // wiped and the self-heal is rebuilding it (~15-40s). Retry automatically
    // instead of dead-ending the user with the generic "Down Time" dialog.
    const attemptLogin = async (): Promise<{ status: number; data?: any }> => {
      try {
        return await signInHandler({email:form.email,password:form.password,remember});
      } catch (err: any) {
        return { status: 500 };
      }
    };
    try {
      let res = await attemptLogin();
      if (res.status === 503 && res.data?.recovering) {
        // Backend is rebuilding the account system — wait and retry (2 tries).
        for (let retry = 0; retry < 2; retry++) {
          await new Promise(r => setTimeout(r, 15000));
          res = await attemptLogin();
          if (res.status !== 503 || !res.data?.recovering) break;
        }
      }
      switch (res.status) {
        case 200:
          try {
            const data = {
              userID: res.data.userData.userID,
              userName: res.data.userData.userName,
              email: res.data.userData.email,
              mobile_number: res.data.userData.mobile_number,
              dob: res.data.userData.dob,
            };
            dispatch(setDefaultAccount(data));
            // Merge the guest (pre-login) cart into the user's server cart,
            // then restore the merged cart. Without this the cart added
            // before login appeared to vanish after signing in.
            await syncCartAfterLogin(data.userID);
            setloading(false);
            setLoggedIn(true);
            router.push('/');
          } catch (tokenError) {
            setloading(false);
            toggleServerError(); // Optionally, handle token verification errors differently
          }
          break;
        case 401:
        case 404:
        case 205:
          setloading(false);
          toggleIsIncorrect();
          break;
        default:
          setloading(false);
          toggleServerError();
          break;
      }
    } catch (err) {
      setloading(false);
      toggleServerError();
    }
  };

  const registerUser = async (
    form: {
      userName: string;
      email: string;
      password: string;
      mobile_number: number;
      dob: string;
    },
    promotional: boolean,
    setloading:React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    try {
      const res = await signUpHandler(form,promotional);
      switch (res.status) {
        case 200:
          // Account created — show the success message and take the user to
          // the sign-in page (no silent auto-login).
          setloading(false);
          toggleSignupSuccess();
          break;
        case 409:
        case 205:
          setloading(false);
          toggleIsExists();
          break;
        default:
          setloading(false);
          toggleServerError();
          break;
      }
    } catch (err) {
      toggleServerError();
    }
  };
  const checkSession = async () => {
      try {
        const res = await sessionHandler();
        switch (res.status) {
          case 200:
            try {
              const data = {
                userID: res.data.userData.userID,
                userName: res.data.userData.userName,
                email: res.data.userData.email,
                mobile_number: res.data.userData.mobile_number,
                dob: res.data.userData.dob,
              };
              dispatch(setDefaultAccount(data));
              setLoggedIn(true);
              return {success:true,data};
            } catch (tokenError) {
              // console.log('Login Failed')
              return {success:false};
            }
          case 500:
            // console.log('Server Error');
            return {success:false};
        }
      } catch (err) {
        return {success:false};
        // console.log("Login Failed");
      }
  };
  const checkAuthLogin = async (authCode:string,setloading:React.Dispatch<React.SetStateAction<boolean>>)=>{
    try {
      const res = await authDataHandler(authCode);
      switch (res.status) {
        case 200:
          try {
            const data = {
              userID: res.data.userData.userID,
              userName: res.data.userData.userName,
              email: res.data.userData.email,
              mobile_number: res.data.userData.mobile_number,
              dob: res.data.userData.dob,
            };
            dispatch(setDefaultAccount(data));
            // Merge the guest (pre-login) cart into the user's server cart,
            // then restore the merged cart. Without this the cart added
            // before login appeared to vanish after signing in.
            await syncCartAfterLogin(data.userID);
            setloading(false);
            setLoggedIn(true);
            router.push('/');
          } catch (tokenError) {
            setloading(false);
            toggleServerError(); // Optionally, handle token verification errors differently
          }
          break;
        case 401:
        case 404:
        case 205:
          setloading(false);
          toggleIsIncorrect();
          break;
        default:
          setloading(false);
          toggleServerError();
          break;
      }
    } catch (error) {
      setloading(false);
      toggleServerError();
    }
    }
  return { checkLogin, registerUser, checkSession, checkAuthLogin };
};

export default useAuth;
