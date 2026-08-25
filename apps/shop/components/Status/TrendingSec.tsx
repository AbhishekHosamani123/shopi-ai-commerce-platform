import Link from 'next/link';
import React from 'react';

interface DataPattern {
  data: {
    productid: number;
    title: string;
    price: number;
    discount: number;
    imglink: string;
    imgalt: string;
    category_name: string;
    maincategory: string;
  }[];
  isSecondary: boolean;
}

const TrendingPrimary = (props: DataPattern) => {
  function categoryLink(maincategory: string, category: string) {
    const splitCat = category ? category.split(' ').join('-') : 'all';
    return `/sub-category/${maincategory || 'all'}/${splitCat}`;
  }

  return (
    <>
      {props.data.map((each, index) => (
        <div
          key={each.productid || index}
          className={`flex mt-5 ${!props.isSecondary && 'mr-5'} static border border-slate-200 rounded-xl mb-2 min-w-[310px] max-w-[310px] h-[110px] items-center bg-white hover:shadow-md transition-shadow`}
        >
          <Link href={`/product/${each.productid}`} prefetch={true}>
            <img
              className="ml-2 w-[75px] h-[60px] object-cover rounded-md"
              src={each.imglink}
              alt={each.title}
              loading="lazy"
              decoding="async"
              width={75}
              height={60}
            />
          </Link>
          <div className="ml-3 w-[200px]">
            <Link href={`/product/${each.productid}`} prefetch={true}>
              <p className="text-sm text-slate-800 font-semibold tracking-normal overflow-hidden whitespace-nowrap text-ellipsis w-full hover:text-[#0D94FB] transition-colors">
                {each.title}
              </p>
            </Link>
            <Link href={categoryLink(each.maincategory, each.category_name)} prefetch={true}>
              <p className="tracking-normal text-slate-400 font-normal text-xs hover:text-[#0D94FB] truncate transition-colors">
                {each.category_name}
              </p>
            </Link>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-sm text-slate-900 font-bold">₹{each.discount}</p>
              <p className="text-xs line-through font-normal text-slate-400">
                ₹{each.price}
              </p>
            </div>
          </div>
        </div>
      ))}
    </>
  );
};

export default TrendingPrimary;