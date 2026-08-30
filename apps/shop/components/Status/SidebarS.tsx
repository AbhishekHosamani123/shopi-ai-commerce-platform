"use client";
import React, { useEffect, useState } from 'react';
import { leftStatus } from '@/app/data';
import Stars from '../ProductUi/Stars';
import Link from 'next/link';
import { sidebarDataHandler } from '@/app/api/homeData';

interface Product {
  productid: number;
  title: string;
  price: number;
  discount: number;
  imglink: string;
  imgalt: string;
  category_name: string;
  stars: number;
  rating: number;
}

const BestSellersSkeleton = () => (
  <div className="space-y-4 py-2 animate-pulse">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-[80px] h-[80px] bg-slate-200 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-4/5 h-3.5 bg-slate-200 rounded" />
          <div className="w-1/2 h-3 bg-slate-200 rounded" />
          <div className="w-1/3 h-4 bg-slate-200 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const SidebarS = () => {
  const [data, setData] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedIndex, setCollapsedIndex] = useState<number | null>(null);

  const handleToggle = (index: number) => {
    setCollapsedIndex((prevIndex) => (prevIndex === index ? null : index));
  };

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      const res = await sidebarDataHandler();
      if (!isMounted) return;
      if (res.status === 200 && res.data?.data) {
        setData(res.data.data);
      }
      setLoading(false);
    }
    sync();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <div className="hidden lg:flex-col lg:flex ml-auto">
        {/* Category Accordion */}
        <div className="border border-slate-200 rounded-xl h-auto w-[220px] xl:w-[320px] p-[15px] bg-white">
          <p className="tracking-[2px] font-semibold text-slate-700 mb-4 text-xs uppercase">CATEGORY</p>
          {leftStatus.map((stat, index) => (
            <div key={index}>
              <div
                className={`flex text-base mb-3 cursor-pointer select-none ${
                  collapsedIndex === index ? 'border-b border-slate-100 pb-2' : ''
                }`}
                onClick={() => handleToggle(index)}
              >
                <div className="flex justify-between items-center w-[100%] text-[20px]">
                  <div className="flex justify-center items-center">
                    <img className="h-[20px] w-[20px] mr-2" src={stat.imgLink} alt={stat.title} />
                    <p className="text-sm font-medium text-slate-700 tracking-tight">{stat.title}</p>
                  </div>
                  <p className="text-slate-400 text-sm font-bold">{collapsedIndex === index ? '−' : '+'}</p>
                </div>
              </div>
              <div
                className={`transition-[max-height] duration-300 ease-in-out overflow-hidden ${
                  collapsedIndex === index ? 'max-h-[160px]' : 'max-h-0'
                }`}
              >
                <div className="border-b border-slate-100 pb-2 pl-6">
                  {stat.links.map((link, linkIndex) => (
                    <Link
                      href={link.link}
                      key={linkIndex}
                      prefetch={true}
                      className="flex justify-between py-1 items-center text-slate-500 hover:text-[#0D94FB] text-xs transition-colors"
                    >
                      <p className="tracking-tight">{link.title}</p>
                      <span className="text-[10px] text-slate-400">›</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Best Sellers Section */}
        <div className="mt-8 relative border border-slate-200 rounded-xl p-4 bg-white shadow-xs">
          <p className="font-semibold text-slate-800 tracking-wider text-xs uppercase mb-4 pb-2 border-b border-slate-100">BEST SELLERS</p>
          {loading ? (
            <BestSellersSkeleton />
          ) : (
            <div className="flex flex-col">
              {data.map((each, index) => (
                <div key={each.productid || index} className="flex items-center py-3 border-b border-slate-100 last:border-b-0 last:pb-1">
                  <Link href={`/product/${each.productid}`} prefetch={true} className="w-[80px] h-[80px] bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-center p-1.5 shrink-0 group hover:border-[#0D94FB]/40 transition-colors">
                    <img
                      className="max-w-full max-h-full object-contain transition-transform duration-200 group-hover:scale-105"
                      src={each.imglink}
                      alt={each.title}
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                  <div className="ml-3.5 max-w-[200px] flex flex-col gap-0.5">
                    <Link
                      href={`/product/${each.productid}`}
                      prefetch={true}
                      className="tracking-tight text-xs font-semibold text-slate-800 hover:text-[#0D94FB] line-clamp-2 transition-colors leading-snug"
                    >
                      {each.title}
                    </Link>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Stars stars={each.stars} />
                      {each.rating > 0 && <p className="text-[11px] text-slate-400">({each.rating})</p>}
                    </div>
                    <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                      <p className="text-sm font-bold text-slate-900">₹{each.discount}</p>
                      {each.price > each.discount && (
                        <p className="text-xs line-through text-slate-400">₹{each.price}</p>
                      )}
                      {each.price > each.discount && (
                        <span className="text-[10px] font-bold text-emerald-600">
                          {Math.round(((each.price - each.discount) / each.price) * 100)}% OFF
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default SidebarS;
