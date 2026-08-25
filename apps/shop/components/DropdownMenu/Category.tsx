import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { categoryDropDown } from '@/app/data';

const Category = () => {
  const [margin, setMargin] = useState(10);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMargin(0);
      setOpacity(1);
    }, 5);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      style={{
        marginTop: `${margin * 0.25}rem`,
        opacity: opacity,
        transition: 'margin-top 0.2s ease-in-out, opacity 0.3s ease-in-out',
      }}
      className="xl:min-h-[450px] xl:min-w-[1280px] min-h-[400px] min-w-[1000px] xl:-left-40 z-30 absolute bg-white flex gap-5 rounded-lg drop-shadow-md px-8 py-8"
    >
      {categoryDropDown.map((each, index) => (
        <div key={index}>
          <div className="border-b-[1px] pb-3">
            <Link
              href={`/categories/${each.catLink}`}
              prefetch={true}
              className="font-semibold text-base text-slate-800 hover:text-[#0D94FB] transition-colors"
            >
              {each.title}
            </Link>
          </div>
          <div className="flex flex-col gap-2 mb-8 mt-5">
            {each.subCategories.map((sub, subIndex) => (
              <Link
                href={sub.link}
                prefetch={true}
                className="text-slate-500 hover:text-[#0D94FB] text-sm transition-colors"
                key={subIndex}
              >
                {sub.title}
              </Link>
            ))}
          </div>
          <Link href={each.imgRedirectLink} prefetch={true}>
            <img
              height={80}
              width={300}
              className="rounded-lg object-cover"
              src={each.imgLink}
              alt={each.title}
              loading="lazy"
              decoding="async"
            />
          </Link>
        </div>
      ))}
    </div>
  );
};

export default Category;