import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { bannerDataHandler } from '@/app/api/homeData';

interface BannerItem {
  bannerid: number;
  toptitle: string;
  middletitle: string;
  bottomtitle: string;
  imglink: string;
  startprice: number | string;
  buttontitle: string;
  redirect_link: string;
}

const DEFAULT_BANNERS: BannerItem[] = [
  {
    bannerid: 1,
    toptitle: 'Starting From ₹499',
    middletitle: 'Exclusive Men & Women Fashion',
    bottomtitle: 'Top Rated Styles From ₹',
    startprice: '499',
    buttontitle: 'Shop Now',
    imglink: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1600&q=80',
    redirect_link: '/sub-category/Clothing/Shirts',
  },
  {
    bannerid: 2,
    toptitle: 'Up to 60% OFF',
    middletitle: 'Trending Footwear & Sneakers',
    bottomtitle: 'Starting at ₹',
    startprice: '799',
    buttontitle: 'Explore Now',
    imglink: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1600&q=80',
    redirect_link: '/sub-category/Footwear/Sports%20Shoes',
  },
  {
    bannerid: 3,
    toptitle: 'New Season 2026',
    middletitle: 'Luxury Watches & Accessories',
    bottomtitle: 'Best Deals From ₹',
    startprice: '999',
    buttontitle: 'View Collection',
    imglink: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1600&q=80',
    redirect_link: '/sub-category/Accessories/Watches',
  },
];

const Banner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [banners, setBanners] = useState<BannerItem[]>(DEFAULT_BANNERS);

  const nextSlide = () => {
    setBanners((current) => {
      const len = current.length || DEFAULT_BANNERS.length;
      setCurrentIndex((prev) => (prev + 1) % len);
      return current;
    });
  };

  const prevSlide = () => {
    setBanners((current) => {
      const len = current.length || DEFAULT_BANNERS.length;
      setCurrentIndex((prev) => (prev - 1 + len) % len);
      return current;
    });
  };

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      try {
        const res = await bannerDataHandler();
        if (!isMounted) return;
        if (res?.status === 200 && res.banners?.data && res.banners.data.length > 0) {
          const formatted = res.banners.data.map((b: any, idx: number) => ({
            bannerid: b.bannerid || idx + 1,
            toptitle: b.toptitle || b.title || 'Exclusive Deals',
            middletitle: b.middletitle || b.subtitle || 'Shop Trending Collection',
            bottomtitle: b.bottomtitle || 'Starting from ₹',
            startprice: b.startprice || '499',
            buttontitle: b.buttontitle || 'Shop Now',
            imglink: b.imglink || b.imageurl || DEFAULT_BANNERS[idx % DEFAULT_BANNERS.length].imglink,
            redirect_link: b.redirect_link || b.link || '/categories/Clothing',
          }));
          setBanners(formatted);
        }
      } catch (err) {
        // Fallback to default banners
      }
    }
    sync();
    return () => {
      isMounted = false;
    };
  }, []);

  // Auto-advance banner every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % (banners.length || 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [banners.length]);

  const activeBanners = banners.length > 0 ? banners : DEFAULT_BANNERS;

  return (
    <div className="relative flex flex-col items-center mt-4 w-full px-4 sm:px-6">
      <div className="relative max-w-[1300px] w-full overflow-hidden rounded-2xl shadow-xl shadow-slate-900/5">
        <div
          className="flex transition-transform duration-700 ease-out relative"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {activeBanners.map((each, index) => (
            <div key={each.bannerid || index} className="flex-shrink-0 w-full">
              <div className="relative">
                <img
                  className="max-h-[450px] z-10 rounded-2xl object-cover w-full h-[260px] sm:h-[380px] lg:h-[450px]"
                  src={each.imglink}
                  alt={`Slide ${index + 1}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent rounded-2xl z-10" />
                
                <div className="absolute z-20 w-[280px] sm:w-[500px] flex flex-col gap-1.5 md:gap-3 left-6 sm:left-14 md:left-20 bottom-0 top-0 mt-auto mb-auto justify-center text-white">
                  <span className="inline-block w-max px-3 py-1 bg-[#0D94FB] text-white text-xs sm:text-sm font-bold rounded-full uppercase tracking-wider shadow-md">
                    {each.toptitle}
                  </span>
                  <h2 className="text-2xl sm:text-4xl md:text-5xl font-black text-white leading-tight drop-shadow-md">
                    {each.middletitle}
                  </h2>
                  <p className="text-sm sm:text-lg font-medium text-white/90 drop-shadow">
                    {each.bottomtitle}{' '}
                    <span className="text-xl sm:text-3xl font-extrabold text-amber-300">
                      ₹{each.startprice}
                    </span>
                  </p>
                  <Link
                    href={each.redirect_link || '/categories/Clothing'}
                    className="mt-2 py-2 sm:py-2.5 px-6 bg-white hover:bg-slate-100 text-slate-900 w-max text-xs sm:text-sm rounded-xl font-bold transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105 inline-flex items-center gap-2 cursor-pointer"
                  >
                    {each.buttontitle}
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeBanners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-6 md:left-10 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-2.5 rounded-full shadow-lg z-30 transition-all hover:scale-110 cursor-pointer"
            aria-label="Previous slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-6 md:right-10 top-1/2 transform -translate-y-1/2 bg-white/90 hover:bg-white text-slate-800 p-2.5 rounded-full shadow-lg z-30 transition-all hover:scale-110 cursor-pointer"
            aria-label="Next slide"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-6 flex gap-2 z-30">
            {activeBanners.map((_, dotIdx) => (
              <button
                key={dotIdx}
                onClick={() => setCurrentIndex(dotIdx)}
                className={`h-2.5 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === dotIdx ? 'w-8 bg-[#0D94FB]' : 'w-2.5 bg-white/60 hover:bg-white'
                }`}
                aria-label={`Go to slide ${dotIdx + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Banner;
