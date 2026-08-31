import React from 'react';
import Link from 'next/link';

interface CategoryTrend {
  name: string;
  quantity: number;
  showLink: string;
  icon: (className?: string) => React.ReactNode;
  bgGradient: string;
  iconColor: string;
}

const CATEGORY_TRENDS: CategoryTrend[] = [
  {
    name: 'SHIRTS',
    quantity: 15,
    showLink: '/sub-category/Clothing/Shirts',
    bgGradient: 'from-blue-50 to-indigo-50 border-blue-100',
    iconColor: 'text-blue-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
  {
    name: 'T-SHIRTS',
    quantity: 12,
    showLink: '/sub-category/Clothing/T-Shirts',
    bgGradient: 'from-cyan-50 to-teal-50 border-cyan-100',
    iconColor: 'text-cyan-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
      </svg>
    ),
  },
  {
    name: 'JEANS & PANTS',
    quantity: 10,
    showLink: '/sub-category/Clothing/Jeans',
    bgGradient: 'from-indigo-50 to-violet-50 border-indigo-100',
    iconColor: 'text-indigo-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: 'JACKETS',
    quantity: 8,
    showLink: '/sub-category/Clothing/Jackets',
    bgGradient: 'from-amber-50 to-orange-50 border-amber-100',
    iconColor: 'text-amber-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'DRESSES',
    quantity: 14,
    showLink: '/sub-category/Clothing/Dresses',
    bgGradient: 'from-pink-50 to-rose-50 border-pink-100',
    iconColor: 'text-pink-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    ),
  },
  {
    name: 'SNEAKERS',
    quantity: 12,
    showLink: '/sub-category/Footwear/Sports%20Shoes',
    bgGradient: 'from-emerald-50 to-teal-50 border-emerald-100',
    iconColor: 'text-emerald-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    name: 'FORMAL SHOES',
    quantity: 6,
    showLink: '/sub-category/Footwear/Formal%20Shoes',
    bgGradient: 'from-slate-100 to-gray-100 border-slate-200',
    iconColor: 'text-slate-700',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    name: 'BAGS & ACCESSORIES',
    quantity: 9,
    showLink: '/sub-category/Accessories/Handbags',
    bgGradient: 'from-purple-50 to-fuchsia-50 border-purple-100',
    iconColor: 'text-purple-600',
    icon: (cls = 'w-6 h-6') => (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    ),
  },
];

const Trends = () => {
  return (
    <div className="w-full max-w-[1300px] px-4 sm:px-6 my-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
          Explore Popular Categories
        </h2>
        <span className="text-xs font-semibold text-slate-400">Swipe to browse →</span>
      </div>

      <div className="flex overflow-x-auto gap-4 pb-3 pt-1 snap-x scrollbar-thin scrollbar-thumb-slate-200">
        {CATEGORY_TRENDS.map((cat, index) => (
          <div
            key={index}
            className={`min-w-[260px] sm:min-w-[280px] p-3.5 rounded-2xl border bg-gradient-to-br ${cat.bgGradient} flex justify-between items-center snap-start transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-xl bg-white shadow-xs ${cat.iconColor}`}>
                {cat.icon('w-6 h-6')}
              </div>
              <div>
                <p className="text-xs sm:text-sm font-black text-slate-900 tracking-wide">
                  {cat.name}
                </p>
                <Link
                  href={cat.showLink}
                  prefetch={true}
                  className="text-xs font-bold text-[#0D94FB] hover:text-[#012652] transition-colors inline-flex items-center gap-1 mt-0.5"
                >
                  Show All
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-white/80 border border-slate-200/60 text-xs font-bold text-slate-500 shadow-2xs">
              {cat.quantity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Trends;