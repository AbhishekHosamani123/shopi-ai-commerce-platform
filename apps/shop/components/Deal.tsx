import React, { useEffect, useState } from 'react';
import DealTime from './DealTime';
import ProgressBar from './ProgressBar';
import Stars from './ProductUi/Stars';
import { dealDataHandler } from '@/app/api/homeData';
import Link from 'next/link';

interface DealProduct {
  productid: number | string;
  title: string;
  stars: number;
  description: string;
  price: number | string;
  discount: number | string;
  discountedprice?: string;
  mrp?: number;
  selling_price?: number;
  sold: number;
  available: number;
  rating: number;
  imglink: string;
  imgalt: string;
  end_time: string;
}

const DealSkeleton = () => (
  <div className="flex flex-col lg:flex-row gap-8 items-center w-full p-4 animate-pulse">
    <div className="w-[300px] lg:w-[400px] h-[300px] bg-slate-200 rounded-xl shrink-0" />
    <div className="flex-1 space-y-4 w-full">
      <div className="w-1/4 h-4 bg-slate-200 rounded" />
      <div className="w-3/4 h-6 bg-slate-200 rounded" />
      <div className="w-full h-12 bg-slate-200 rounded" />
      <div className="w-1/3 h-8 bg-slate-200 rounded" />
      <div className="w-40 h-11 bg-slate-200 rounded-xl" />
    </div>
  </div>
);

const Deal = () => {
  const [deals, setDeals] = useState<DealProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      const res = await dealDataHandler();
      if (!isMounted) return;
      if (res.status === 200 && res.deals?.data) {
        setDeals(res.deals.data);
      }
      setLoading(false);
    }
    sync();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="mt-10 sm:ml-4 ml-auto mr-auto max-w-[350px] md:max-w-[800px] xl:max-w-[1000px] flex flex-col justify-center">
      <p className="border-b-[1px] leading-[50px] tracking-[1.5px] font-semibold text-[18px]">Deal of The Day</p>
      <div className="p-6 md:p-8 border border-slate-200 mt-6 rounded-xl overflow-auto snap-x snap-proximity flex gap-20 relative bg-white">
        {loading && <DealSkeleton />}
        {!loading &&
          deals.map((each, index) => (
            <div
              key={each.productid || index}
              className="flex flex-col rounded-xl min-w-full gap-6 h-auto items-center lg:pl-6 snap-center lg:flex-row"
            >
              <Link href={`/product/${each.productid}`} prefetch={true} className="w-[300px] lg:w-[400px] h-[300px] bg-slate-50 rounded-xl flex items-center justify-center p-4 border border-slate-100 shrink-0">
                <img
                  className="max-w-full max-h-full object-contain"
                  alt={each.imgalt}
                  src={each.imglink}
                  loading="lazy"
                  decoding="async"
                />
              </Link>
              <div className="flex flex-col gap-3.5 w-full">
                <div className="flex items-center gap-2">
                  <Stars stars={each.stars} />
                  {each.rating > 0 && <p className="text-xs text-slate-400">({each.rating})</p>}
                </div>
                <Link href={`/product/${each.productid}`} prefetch={true}>
                  <p className="text-lg font-bold text-slate-900 hover:text-[#0D94FB] transition-colors">{each.title}</p>
                </Link>
                <p className="text-sm tracking-normal text-slate-500 line-clamp-2 leading-relaxed">{each.description}</p>
                <div className="flex items-baseline gap-3 flex-wrap">
                  <p className="text-2xl font-extrabold text-slate-900">
                    ₹{each.selling_price || Number(each.discount) || Number(each.discountedprice) || 0}
                  </p>
                  {(each.mrp || each.price) && (each.mrp || Number(each.price)) > (each.selling_price || Number(each.discount) || Number(each.discountedprice) || 0) && (
                    <p className="text-sm line-through text-slate-400">
                      ₹{each.mrp || each.price}
                    </p>
                  )}
                  {(each.mrp || Number(each.price)) > (each.selling_price || Number(each.discount) || Number(each.discountedprice) || 0) && (
                    <span className="text-sm font-bold text-emerald-600">
                      {Math.round((((each.mrp || Number(each.price)) - (each.selling_price || Number(each.discount) || Number(each.discountedprice) || 0)) / (each.mrp || Number(each.price))) * 100)}% OFF
                    </span>
                  )}
                </div>
                <Link href={`/product/${each.productid}`} prefetch={true}>
                  <button className="bg-[#0D94FB] hover:bg-[#012652] px-6 py-2.5 rounded-xl text-white font-bold text-sm transition-colors duration-200 shadow-md shadow-[#0D94FB]/20 cursor-pointer">
                    Visit Product
                  </button>
                </Link>
                <div className="flex justify-between text-xs text-slate-600 font-medium mt-1">
                  <p>
                    ALREADY SOLD: <span className="font-bold text-slate-900">{each.sold}</span>
                  </p>
                  <p>
                    AVAILABLE: <span className="font-bold text-slate-900">{each.available}</span>
                  </p>
                </div>
                <ProgressBar sold={each.sold} total={each.available} />
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-1">HURRY UP! OFFER ENDS IN:</p>
                <DealTime endTime={each.end_time} />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default Deal;