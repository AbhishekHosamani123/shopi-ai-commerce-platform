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
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
                </svg>
              ),
              hoverColor: 'hover:bg-[#0A66C2] hover:text-white',
            },
            {
              name: 'GitHub',
              url: 'https://github.com/AbhishekHosamani123',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"/>
                </svg>
              ),
              hoverColor: 'hover:bg-[#24292F] hover:text-white',
            },
            {
              name: 'Portfolio',
              url: 'http://portfolio-website-nu-five-23.vercel.app/',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm6.92 9h-3.14a12.87 12.87 0 0 0-1.12-4.46A8.04 8.04 0 0 1 18.92 11zm-5.92-7a11 11 0 0 1 1.94 6H11a11 11 0 0 1 1.94-6zM4.08 13h3.14a12.87 12.87 0 0 0 1.12 4.46A8.04 8.04 0 0 1 4.08 13zm3.14-2H4.08a8.04 8.04 0 0 1 4.14-4.46A12.87 12.87 0 0 0 7.22 11zm3.72 7a11 11 0 0 1-1.94-6h6a11 11 0 0 1-1.94 6zm4.72-1.54a12.87 12.87 0 0 0 1.12-4.46h3.14a8.04 8.04 0 0 1-4.26 4.46z"/>
                </svg>
              ),
              hoverColor: 'hover:bg-[#0D94FB] hover:text-white',
            },
            {
              name: 'Instagram',
              url: 'https://www.instagram.com/abhishek_hosamani___/?hl=en',
              icon: (
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                </svg>
              ),
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
              className={`text-slate-400 bg-slate-800 w-[32px] h-[32px] flex items-center justify-center rounded-lg ${item.hoverColor} transition-all`}
            >
              {item.icon}
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