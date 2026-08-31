import Link from 'next/link'
import React,{useState} from 'react'
import { navBtns } from '@/app/data'
import Account from './DropdownMenu/Account';
import { useMenu } from '@/Helpers/MenuContext';
import Product from './DropdownMenu/Product';
import Category from './DropdownMenu/Category';
import { useRouter } from 'next/navigation'
import { HeartIcon,ShoppingBagIcon } from '@heroicons/react/24/outline';
const Navbar = () => {
    const router = useRouter()
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
    const { toggleCart, toggleFav } = useMenu();
    const [isDropdownVisible, setDropdownVisible] = useState<boolean>(false);
    const [selectIndex, setselectIndex] = useState<number | null>(null);
    function searchRedirect(e:any){
        e.preventDefault();
        router.push(`/search/${(e.target.searchEntry.value.split(' ').join('-'))}`)
    }
    return (
    <nav className='w-full h-auto flex flex-col items-center'>
        <div className='h-[50px] w-[100%] justify-evenly items-center border-b-[1px] hidden sm:flex'>
            <div className='flex w-[80%] justify-between items-center'>
                <div className='flex gap-2 items-center'>
                    {socialLinks.map((item, index) => (
                        <a
                            key={index}
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={item.name}
                            aria-label={item.name}
                            className={`text-[13px] text-slate-500 bg-slate-100 w-[26px] h-[26px] flex items-center justify-center rounded-md ${item.hoverColor} transition-all`}
                        >
                            <i className={item.icon}></i>
                        </a>
                    ))}
                </div>
                <div>
                    <p className='text-sm text-slate-500'>Free shipping this week on orders over ₹999</p>
                </div>
                <div>
                    <Link href="/categories/Clothing" className='text-sm font-medium text-slate-700 hover:text-[#0D94FB] transition-colors hidden sm:block'>Shop Now</Link>
                </div>
            </div>
        </div>
        <div className='w-[100%] h-auto flex flex-col justify-between items-center border-b-[1px]'>
            <div className='flex justify-evenly items-center w-[100%] flex-col sm:flex-row gap-2 sm:gap-0'>
                <div className='w-[80%] flex justify-between items-center flex-col sm:flex-row sm:gap-0'>
                    <div>
                        <Link className='mr-2.5 text-[24px] font-extrabold tracking-tight text-[#0D94FB] flex items-center gap-1.5' href={"/"}>
                            <span className='text-[#0D94FB] text-[26px] font-black'>✨</span>
                            <span>Shopi</span>
                        </Link>
                    </div>
                    <form onSubmit={searchRedirect} className='border-[1.5px] border-slate-200 rounded-[10px] h-[42px] w-[90%] sm:w-[600px] mb-5 sm:mb-0 flex justify-between items-center'>
                        <input name='searchEntry' placeholder='Enter your product name...' type='text' className='outline-0 ml-5 text-[20px] w-[90%] placeholder:text-base placeholder:text-slate-400 text-slate-800'/>
                        <button type='submit' className='text-[16px] mr-2 text-slate-500 hover:text-slate-800'><i className="fa-solid fa-magnifying-glass"></i></button>
                    </form>
                    <div className='gap-5 text-slate-700 my-8 hidden sm:flex sm:items-center'>
                        {/* <button><i className="fa-regular fa-user fa-xl"></i></button> */}
                        <Account/>
                        <button onClick={toggleFav}><HeartIcon width={40}/></button>
                        <button onClick={toggleCart}><ShoppingBagIcon width={40}/></button>
                    </div>
                </div>
            </div>
        </div>
        <div className='h-[50px] w-[100%] mt-2 justify-center items-center hidden lg:flex'>
            <div className='flex'>
                {navBtns.map((btn,index)=>
                <div key={index} onMouseEnter={()=>{setDropdownVisible(true);setselectIndex(index)}} onMouseLeave={()=>{setDropdownVisible(false);setselectIndex(null)}} className="relative items-center">
                    <Link href={btn.catLink} prefetch={true} className='button-with-border text-[16px] m-6 text-gray-700 font-semibold tracking-wide hover:text-[#0D94FB] transition-colors'>{btn.name.toUpperCase()}</Link>
                    {selectIndex === index && isDropdownVisible && btn.name==='Categories' && (<Category/>)}
                    {selectIndex === index && btn.isExtendable && isDropdownVisible && (
                    <Product options={btn.extendables} />
                    )}
                </div>
                )}
            </div>
        </div>
    </nav>
  )
};

export default Navbar