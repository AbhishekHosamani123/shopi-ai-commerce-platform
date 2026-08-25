import React, { useEffect, useState, useRef } from 'react';
import { HomeIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import SubProducts from './SubProducts';
import { useParams } from 'next/navigation';
import FilterSidebar from '@/components/FilterSidebar';
import SearchMSidebar from '../Mobile-Interface/SearchMSidebar';
import subCategoryDataHandler, { subCategoryFilteredHandler } from '@/app/api/subCategory';

interface Color {
  colorid: number;
  name: string;
  colorname: string;
  colorclass: string;
}

interface Size {
  sizeid: number;
  name: string;
  sizename: string;
  instock: boolean;
}

interface ProductImage {
  imageid: number;
  imglink: string;
  imgalt: string;
}

interface Product {
  productid: number;
  title: string;
  category: string;
  price: string;
  discount: string;
  stars: number;
  isnew: boolean;
  issale: boolean;
  isdiscount: boolean;
  colors: Color[];
  sizes: Size[];
  reviewCount: number;
  images: ProductImage;
}

const SubCategory = () => {
  const categoryCapture = useParams();
  const specficMainCategory: any = categoryCapture.maincategory || 'all';
  const specificCategory: any = categoryCapture.subcategory || 'all';
  const currDirectory = ['Categories', specficMainCategory, specificCategory];

  const [loading, setLoading] = useState(true);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [dataChecked, setDataChecked] = useState(false);
  const categoryID = useRef<number>(0);
  const [clear, setClear] = useState(false);
  const [isMenu, setIsMenu] = useState(false);

  async function filterSubmit(e: any) {
    e.preventDefault();
    setDataChecked(false);
    setLoading(true);
    const values = {
      minPrice: e.target.pricefrom.value,
      maxPrice: e.target.priceto.value,
      rating: e.target.rating.value,
    };
    const response = await subCategoryFilteredHandler({
      categoryID: categoryID.current,
      minPrice: values.minPrice,
      maxPrice: values.maxPrice,
      rating: values.rating,
    });
    if (response.status === 200 && response.data?.data) {
      setProductsData(response.data.data);
    }
    setDataChecked(true);
    setLoading(false);
  }

  async function fetchData() {
    setLoading(true);
    const response = await subCategoryDataHandler(specficMainCategory, specificCategory);
    if (response.status === 200 && response.data?.data) {
      setProductsData(response.data.data);
      if (response.data.categoryid) {
        categoryID.current = response.data.categoryid;
      }
    }
    setDataChecked(true);
    setLoading(false);
  }

  function toggleClear() {
    setClear(!clear);
  }

  useEffect(() => {
    fetchData();
  }, [specficMainCategory, specificCategory, clear]);

  const formatedName = typeof specificCategory === 'string' ? specificCategory.split('-').join(' ') : specificCategory;

  return (
    <>
      <SearchMSidebar
        isMenu={isMenu}
        setIsMenu={setIsMenu}
        dataChecked={dataChecked}
        filterSubmit={filterSubmit}
        toggleClear={toggleClear}
      />
      <section className="flex flex-col gap-6 min-h-[1000px] w-full max-w-7xl px-4 py-6">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <HomeIcon width={20} className="text-slate-400" />
          {currDirectory.map((each, index) => (
            <div className="flex items-center gap-2" key={index}>
              <ChevronDoubleRightIcon width={14} className="text-slate-300" />
              <p className="font-medium capitalize text-slate-700">{each === specificCategory ? formatedName : each}</p>
            </div>
          ))}
        </div>
        <button
          onClick={() => setIsMenu(true)}
          className="rounded-xl lg:hidden px-4 py-2.5 border border-[#0D94FB] font-semibold text-sm text-[#0D94FB] whitespace-nowrap w-[200px] mx-auto text-center shadow-sm transition-all hover:bg-[#0D94FB] hover:text-white"
        >
          Filter Products
        </button>
        <section className="flex gap-8">
          <div className="relative">
            <FilterSidebar
              dataChecked={dataChecked}
              filterSubmit={filterSubmit}
              toggleClear={toggleClear}
              mobileMode={false}
            />
          </div>
          <SubProducts dataChecked={dataChecked} products={productsData} loading={loading} />
        </section>
      </section>
    </>
  );
};

export default SubCategory;