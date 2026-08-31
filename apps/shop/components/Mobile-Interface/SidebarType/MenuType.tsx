import React,{useState} from 'react'
import { navBtns } from '@/app/data'
import { useMenu } from '@/Helpers/MenuContext';
import signOutHandler from '@/app/api/signout';
import { useRouter } from 'next/navigation';
import { useApp } from '@/Helpers/AccountDialog';
const MenuType = () => {
    const socialLinks = [
        {
            name: 'LinkedIn',
            url: 'https://www.linkedin.com/in/abhishek-hosamani/',
            icon: 'fa-brands fa-linkedin-in',
            hoverColor: 'hover:bg-[#0A66C2] hover:text-white',
        },
        {
            name: 'GitHub',
            url: 'https://github.com/AbhishekHosamani123',
            icon: 'fa-brands fa-github',
            hoverColor: 'hover:bg-[#24292F] hover:text-white',
        },
        {
            name: 'Portfolio',
            url: 'http://portfolio-website-nu-five-23.vercel.app/',
            icon: 'fa-solid fa-globe',
            hoverColor: 'hover:bg-[#0D94FB] hover:text-white',
        },
        {
            name: 'Instagram',
            url: 'https://www.instagram.com/abhishek_hosamani___/?hl=en',
            icon: 'fa-brands fa-instagram',
            hoverColor: 'hover:bg-[#E4405F] hover:text-white',
        },
    ];
    const {appState} = useApp();
    const loggedIn = appState.loggedIn;
    const { toggleSidebar } = useMenu();
    const [collapsedIndex, setCollapsedIndex] = useState<number | null>(null);
    const handleToggle = (index: number) => {
        setCollapsedIndex((prevIndex) => (prevIndex === index ? null : index));
    };
    const router = useRouter();
    const handleColl = (index:number) => {
        setCollapsedIndex(collapsedIndex === index ? null : index);
    };
    const AccBtns = [
        {
            name: 'loggedIn',
            isExtendable: true,
            extendables: [
                { title: 'Settings', link: '/account-settings' },
                { title: 'Orders', link: '/orders' },
            ]
        },
        {
            name: 'login',
            isExtendable: true,
            extendables: [
                { title: 'Register', link: '/sign-up' },
                { title: 'Sign In', link: '/sign-in' },
            ]
        }
        // Add other nav buttons here if needed
    ];
    function signOut(){
        signOutHandler();
        router.refresh();
        router.push('/');
      }
  return (
    <>
            <div className='flex w-[90%] items-center justify-between border-b-[1px] pb-4 -left-96'>
                <p className='text-salmon font-bold text-xl tracking-wide'>Menu</p>
                <button  onClick={toggleSidebar}><i className="fa-solid fa-xmark fa-xl"></i></button>
            </div>
            <div className='w-[90%]'>
                {navBtns.map((each,index)=> each.name != 'Categories' &&
                <div key={index}>
                    <div onClick={()=>{each.name!='Blog' ? handleToggle(index) : router.push('/blog')}} className='flex mt-3 border-b-[1px] pb-3 tracking-wider justify-between hover:cursor-pointer'>
                        <p className='text-gray-700'>{each.name}</p>
                        {each.isExtendable && <p className='text-silver font-bold'>{collapsedIndex === index ? '-' : '+'}</p>}
                    </div>
                    {each.isExtendable && <div
                        className={`transition-[max-height] duration-[400ms] ease-linear overflow-hidden ${
                            collapsedIndex === index ? 'max-h-[160px]' : 'max-h-0'
                        }`}>
                        {(
                            <div className='border-b-[1px] pb-2'>
                                {each.extendables.map((link, linkIndex) =>
                                    <a href={link.link} key={linkIndex} className='flex justify-between mt-1 items-center text-silver hover:text-black'>
                                        <p className='tracking-[1px]'>{link.title}</p>
                                    </a>
                                )}
                            </div>
                        )}
                    </div>}
                </div>
                )}
            </div>
            <div className='flex gap-2 mt-4 mb-4'>
                {socialLinks.map((item, index) => (
                    <a
                        key={index}
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={item.name}
                        aria-label={item.name}
                        className={`text-[16px] text-slate-600 bg-gray-100 w-[38px] h-[38px] flex items-center justify-center rounded-lg ${item.hoverColor} transition-all`}
                    >
                        <i className={`${item.icon} fa-lg`}></i>
                    </a>
                ))}
            </div>
            <div className='w-[90%] border-t-[1px]'>
                {AccBtns.map((each,index)=> 
                <div key={index}>
                    <div key={index}
                        className={`transition-[max-height] duration-[400ms] ease-linear overflow-hidden ${
                            'max-h-[160px]'
                        }`}>
                            <div className='pb-2 flex flex-col gap-2 pt-5 '>
                                {each.extendables.map((link, linkIndex) => loggedIn ? each.name === 'loggedIn' &&
                                    <a href={link.link} key={linkIndex} className='flex justify-between mt-1 items-center text-gray-700 border-b-[1px] pb-4 hover:text-black'>
                                        <p className='tracking-[1px]'>{link.title}</p>
                                    </a>
                                    : each.name === 'login' &&
                                    <a href={link.link} key={linkIndex} className='flex justify-between mt-1 items-center text-gray-700 border-b-[1px] pb-4 hover:text-black'>
                                        <p className='tracking-[1px]'>{link.title}</p>
                                    </a>
                                )}
                                
                            </div>
                    </div>
                </div>
                )}
                {loggedIn && <button onClick={signOut} className='flex justify-between mt-1 items-center text-gray-700  pb-4 hover:text-black'>Sign Out</button>}
            </div>
    </>
  )
}

export default MenuType