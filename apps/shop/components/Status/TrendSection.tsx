"use client";
import React, { useEffect, useState } from 'react';
import TrendingPrimary from './TrendingSec';
import { topDataHandler } from '@/app/api/homeData';

interface Product {
  productid: number;
  title: string;
  price: number;
  discount: number;
  imglink: string;
  imgalt: string;
  category_name: string;
  maincategory: string;
}

interface TrendData {
  trending: Product[];
  top_rated: Product[];
  new_arrival: Product[];
}

const TrendColumnSkeleton = () => (
  <div className="w-[300px] space-y-3 py-2 animate-pulse">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="flex gap-3 items-center border border-slate-100 rounded-xl p-2 h-[110px] bg-white">
        <div className="w-[75px] h-[60px] bg-slate-200 rounded-md shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="w-4/5 h-3.5 bg-slate-200 rounded" />
          <div className="w-1/2 h-3 bg-slate-200 rounded" />
          <div className="w-1/3 h-4 bg-slate-200 rounded" />
        </div>
      </div>
    ))}
  </div>
);

const TrendSection = () => {
  const [data, setData] = useState<TrendData>({ trending: [], top_rated: [], new_arrival: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      const res = await topDataHandler();
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
    <div className="flex-wrap xl:w-[100%] w-auto flex justify-center">
      {/* New Arrivals */}
      <div className="sm:ml-4">
        <p className="border-b-[1px] font-semibold text-lg leading-[50px]">New Arrivals</p>
        <div className="flex max-w-[310px] overflow-x-auto snap-x snap-mandatory">
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.new_arrival.slice(0, 4)} isSecondary={false} />
            )}
          </div>
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.new_arrival.slice(4)} isSecondary={true} />
            )}
          </div>
        </div>
      </div>

      {/* Trending */}
      <div className="sm:ml-4 font-semibold text-[18px]">
        <p className="border-b-[1px] leading-[50px]">Trending</p>
        <div className="flex max-w-[310px] overflow-x-auto snap-x snap-mandatory">
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.trending.slice(0, 4)} isSecondary={false} />
            )}
          </div>
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.trending.slice(4)} isSecondary={true} />
            )}
          </div>
        </div>
      </div>

      {/* Top Rated */}
      <div className="sm:ml-4 font-semibold text-[18px]">
        <p className="border-b-[1px] leading-[50px]">Top Rated</p>
        <div className="flex max-w-[310px] overflow-x-auto snap-x snap-mandatory">
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.top_rated.slice(0, 4)} isSecondary={false} />
            )}
          </div>
          <div className="snap-center relative">
            {loading ? (
              <TrendColumnSkeleton />
            ) : (
              <TrendingPrimary data={data.top_rated.slice(4)} isSecondary={true} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrendSection;