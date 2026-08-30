import React, { useEffect, useState } from 'react';
import { bannerDataHandler } from '@/app/api/homeData';

interface Banner {
  bannerid: number;
  toptitle: string;
  middletitle: string;
  bottomtitle: string;
  imglink: string;
  startprice: number;
  buttontitle: string;
  redirect_link: string;
  createdat: Date;
  updatedat: Date;
}

const BannerSkeleton = () => (
  <div className="w-[1300px] max-w-full h-[280px] sm:h-[380px] lg:h-[450px] bg-slate-200 rounded-xl animate-pulse mx-auto" />
);

const Banner = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);

  const nextSlide = () => {
    if (banners.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % banners.length);
  };

  const prevSlide = () => {
    if (banners.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + banners.length) % banners.length);
  };

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      const res = await bannerDataHandler();
      if (!isMounted) return;
      if (res.status === 200 && res.banners?.data) {
        setBanners(res.banners.data);
      }
      setLoading(false);
    }
    sync();
    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="relative flex flex-col items-center mt-4 w-full px-4">
        <BannerSkeleton />
      </div>
    );
  }

  return (
    <div className="relative flex flex-col items-center mt-4 w-full">
      <div className="relative max-w-[1300px] w-full overflow-hidden rounded-xl">
        <div
          className="flex transition-transform duration-500 relative"
          style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {banners.map((each, index) => (
            <div key={each.bannerid || index} className="flex-shrink-0 w-full">
              <div className="relative">
                <img
                  className="max-h-[450px] z-10 rounded-xl object-cover w-full h-[240px] sm:h-[360px] lg:h-[450px]"
                  src={each.imglink}
                  alt={`Slide ${index + 1}`}
                  loading={index === 0 ? 'eager' : 'lazy'}
                  decoding="async"
                />
                <div className="absolute z-[15] md:hidden left-6 sm:left-14 bottom-0 top-0 mt-auto mb-auto bg-white/70 backdrop-blur-xs w-[280px] h-[180px] sm:w-[480px] sm:h-[220px] rounded-xl" />
                <div className="absolute z-20 w-[260px] h-[180px] md:h-auto sm:w-[500px] flex flex-col gap-1 md:gap-3 md:left-24 left-10 bottom-0 top-0 mt-auto mb-auto justify-center">
                  <p className="text-[#0D94FB] lg:text-2xl text-lg font-bold tracking-tight">{each.toptitle}</p>
                  <p className="sm:text-4xl text-xl font-extrabold text-slate-900 leading-tight">{each.middletitle}</p>
                  <p className="sm:text-xl text-sm font-medium text-slate-600">
                    {each.bottomtitle}{' '}
                    <span className="lg:text-3xl text-lg font-bold text-slate-900">{each.startprice}</span>
                  </p>
                  <button className="sm:py-2.5 py-2 bg-[#0D94FB] hover:bg-[#012652] text-white px-6 sm:w-[150px] w-[120px] text-xs sm:text-sm rounded-xl font-semibold transition-all duration-200 shadow-md shadow-[#0D94FB]/20 mt-1 cursor-pointer">
                    {each.buttontitle}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {banners.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute left-2 md:left-6 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg z-30 transition-all cursor-pointer"
            aria-label="Previous slide"
          >
            <i className="fa-solid fa-chevron-left text-sm"></i>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-2 md:right-6 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg z-30 transition-all cursor-pointer"
            aria-label="Next slide"
          >
            <i className="fa-solid fa-chevron-right text-sm"></i>
          </button>
        </>
      )}
    </div>
  );
};

export default Banner;
