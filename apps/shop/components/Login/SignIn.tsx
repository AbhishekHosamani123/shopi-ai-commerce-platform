import { CheckIcon } from '@heroicons/react/24/outline'
import React,{useState} from 'react'
import { loginFeatures } from '@/app/data';
import Link from 'next/link';
import { Checkbox } from '@headlessui/react'
import useAuth from '@/controllers/Authentication';
import { useGoogleLogin } from '@react-oauth/google';
import Loading from '../Loading';
const SignIn = () => {
    const [enabled, setEnabled] = useState(false)
    const {checkLogin,checkAuthLogin} = useAuth();
    const [loading, setloading] = useState(false);
    async function login(e:any,remember:boolean){
        e.preventDefault();
        setloading(true);
        await checkLogin({email:e.target.email.value,password:e.target.password.value},remember,setloading);
    }
    const responseGoogle = async (authResult:any) => {
		try {
			if (authResult["code"]) {
				await checkAuthLogin(authResult.code,setloading);
			} else {
                setloading(false);
				throw new Error(authResult);
			}
		} catch (e) {
            setloading(false)
		}
	};

	const googleLogin = useGoogleLogin({
		onSuccess: responseGoogle,
		onError: responseGoogle,
		flow: "auth-code",
	});
    return (
        <>
        <section className={`bg-gray-50 h-screen w-screen flex items-start lg:items-center overflow-x-hidden`}>
        {loading && <div className='w-full h-full absolute'>{loading && <div className='absolute left-0 right-0 top-[30%] z-50'><Loading/></div>}</div> }
            <section className="w-[95%] mx-auto flex justify-center">
                <div className='flex lg:h-[650px] justify-between items-center gap-10'>
                    <div className='h-full lg:flex lg:flex-col w-auto hidden lg:justify-between'>
                        <div>
                            <Link href="#" className="flex items-center text-2xl mb-2 font-semibold text-gray-900">
                                <span className="text-2xl mr-2">⚡</span>
                                Razorpay AI Commerce    
                            </Link>
                            <div className='flex flex-col gap-5'>
                                {loginFeatures.map((each,index)=>
                                <div key={index} className='flex gap-4 items-start'>
                                    <CheckIcon width={25} className='text-white bg-primary-600 rounded-full py-1 px-1 mt-2'/>
                                    <div>
                                        <h1 className='font-medium'>{each.title}</h1>
                                        <p className='text-sm font-medium'>{each.description}</p>
                                    </div>
                                </div>
                                )}
                            </div>
                        </div>
                        <div className='flex gap-5 text-gray-500 font-medium text-sm'>
                            <Link className='hover:underline hover:text-gray-800' href={'/about'}>About</Link>
                            <Link className='hover:underline hover:text-gray-800' href={'/policy/terms&conditions'}>Terms & Conditions</Link>
                            <Link className='hover:underline hover:text-gray-800' href={'/policy/privacypolicy'}>Privacy</Link>
                            <Link className='hover:underline hover:text-gray-800' href={'/contact'}>Contact</Link>
                        </div>
                        
                    </div>
                    <div className="flex flex-col items-center justify-center min-w-[500px] px-6 py-8 mx-auto md:h-screen lg:py-0">
                    <Link href="#" className="flex items-center text-2xl font-semibold text-gray-900 dark:text-white lg:hidden">
                        <span className="text-2xl mr-2">⚡</span>
                        Razorpay AI Commerce    
                    </Link>
                        <div className="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
                            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
                                <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl">
                                    Welcome back
                                </h1>
                                <h1 className='font-semibold'>Sign in With</h1>
                                <div className='flex justify-between gap-2'>
                                    <button onClick={()=>{setloading(true);googleLogin()}} className='px-6 w-4/6 mx-auto py-3 border-[1px] border-gray-200 rounded-lg text-sm font-medium transition-colors duration-150 hover:bg-gray-700 hover:text-white'>
                                        <div className='flex items-center justify-center gap-2'>
                                            <svg className="w-5 h-5" viewBox="0 0 48 48">
                                                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                                                <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.77H24v9.03h12.75c-.55 2.86-2.18 5.29-4.62 6.92l7.17 5.56C43.5 35.8 46.5 30.3 46.5 24z"/>
                                                <path fill="#34A853" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z"/>
                                                <path fill="#FBBC05" d="M24 38.5c-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48c6.48 0 11.93-2.13 15.89-5.81l-7.17-5.56c-2.3 1.54-5.23 2.37-8.72 2.37z"/>
                                            </svg>
                                            Google
                                        </div>
                                    </button>
                                </div>
                                <form onSubmit={(e)=>login(e,enabled)} method='post' className="space-y-4 md:space-y-6 flex flex-col gap-4 lg:gap-0" action="/">
                                    
                                    <div className='flex w-full items-center'>
                                        <div className='w-full h-[2px] bg-gray-200'></div>
                                        <p className='px-4 text-gray-500'>or</p>
                                        <div className='w-full h-[2px] bg-gray-200'></div>
                                    </div>
                                    <div data-validate = "Enter Email">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Email</label>
                                        <input maxLength={128} minLength={5} required type="email" name="email" id="email" className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5" placeholder="Enter your email"/>
                                    </div>
                                    <div data-validate = "Enter Password">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Password</label>
                                        <input minLength={8} maxLength={32} required type="password" name="password" id="password" placeholder="••••••••" className="bg-gray-50 border border-gray-300 text-gray-900 sm:text-sm rounded-lg focus:ring-primary-600 focus:border-primary-600 block w-full p-2.5"/>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-start">
                                            <div className="flex items-center h-5">
                                            <Checkbox
                                            checked={enabled}
                                            onChange={setEnabled}
                                            className="group block size-5 rounded border bg-white data-[checked]:bg-blue-500 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 data-[checked]:data-[disabled]:bg-gray-500"
                                            >
                                            <svg className="stroke-white opacity-0 group-data-[checked]:opacity-100" viewBox="0 0 14 14" fill="none">
                                                <path d="M3 8L6 11L11 3.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                            </Checkbox>
                                            </div>
                                            <div className="ml-3 text-sm">
                                                <label className="text-gray-500">Remember me</label>
                                            </div>
                                        </div>
                                        <Link href="/forgot-password" className="text-sm font-medium text-primary-600 hover:underline">Forgot password?</Link>
                                    </div>
                                    <button type="submit" className="w-full text-white bg-primary-600 hover:bg-primary-700 focus:ring-4 focus:outline-none focus:ring-primary-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center">Sign in to your account</button>
                                    <p className="text-sm font-light text-gray-500">
                                        Don’t have an account yet? <Link href="/sign-up" className="font-medium text-primary-600 hover:underline">Sign up</Link>
                                    </p>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
                
            </section>
        </section>
    </>
  )
}

export default SignIn