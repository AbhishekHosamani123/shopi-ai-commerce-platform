import React from 'react';
import { footerCategories, footerSections } from '@/app/data';
import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-footerblack w-full flex flex-col mt-auto shrink-0 z-10">
      <div className="flex flex-col justify-center items-center border-b border-silver/40 mt-16 pb-12 w-full">
        <div className="max-w-7xl w-full px-4">
          <p className="text-salmon font-semibold text-sm tracking-widest uppercase">Brand Directory</p>
          {footerCategories.map((each, index) => (
            <div key={index} className="flex mt-4 flex-wrap items-center text-xs">
              <p className="text-footergray font-semibold mr-2">{each.name}:</p>
              {each.subcategories.map((each1, index1) => (
                <div key={index1} className="flex items-center">
                  <Link href={each1.subcatLink} className="text-silver tracking-wide hover:text-white transition-colors">
                    {each1.name}
                  </Link>
                  {index1 < each.subcategories.length - 1 && (
                    <span className="bg-silver/40 w-[1px] mx-2 h-3" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl w-full mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 border-b border-silver/40">
        {footerSections.map((each, index) => (
          <div key={index} className="flex flex-col">
            <p className="text-white font-bold text-sm tracking-wider uppercase mb-1">{each.sectionName}</p>
            <span className="border-b-2 w-12 border-salmon mb-4"></span>
            <div className="gap-2.5 flex flex-col text-xs">
              {each.items.map((each1, index1) => (
                <Link href={each1.link} key={index1} className="text-silver hover:text-white transition-colors">
                  {each1.title}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="w-full gap-4 flex flex-col items-center py-8 mb-16 lg:mb-0">
        <div className="flex items-center gap-3">
          {[
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
          ].map((item, index) => (
            <a
              key={index}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              title={item.name}
              aria-label={item.name}
              className={`text-[14px] text-slate-400 bg-slate-800 w-[32px] h-[32px] flex items-center justify-center rounded-lg ${item.hoverColor} transition-all`}
            >
              <i className={item.icon}></i>
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold text-slate-500 bg-slate-100 px-4 py-2 rounded-xl">
          <span className="text-blue-700 font-bold tracking-tight">VISA</span>
          <span>•</span>
          <span className="text-red-600 font-bold tracking-tight">Mastercard</span>
          <span>•</span>
          <span className="text-emerald-700 font-bold tracking-tight">UPI</span>
          <span>•</span>
          <span className="text-blue-600 font-bold tracking-tight">Razorpay</span>
        </div>
        <p className="text-silver text-xs font-medium tracking-wide">
          Copyright &copy; 2026 Shopi. All Rights Reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;