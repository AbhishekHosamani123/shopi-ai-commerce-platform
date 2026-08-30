import React, { useEffect, useState, useRef } from 'react';
import { HomeIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import SubProducts from './SubProducts';
import { useParams, useSearchParams } from 'next/navigation';
import FilterSidebar from '@/components/FilterSidebar';
import SearchMSidebar from '../Mobile-Interface/SearchMSidebar';
import subCategoryDataHandler, { subCategoryFilteredHandler } from '@/app/api/subCategory';
import Link from 'next/link';

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
  productid: number | string;
  sku?: string;
  title: string;
  category: string;
  price: string;
  discount: string;
  discountedprice?: string;
  mrp?: number;
  selling_price?: number;
  discount_percentage?: number;
  stars: number;
  isnew?: boolean;
  issale?: boolean;
  isdiscount?: boolean;
  colors: Color[];
  sizes: Size[];
  reviewCount: number;
  images: ProductImage;
}

const SubCategory = () => {
  const categoryCapture = useParams();
  const searchParams = useSearchParams();
  const specficMainCategory: string = String(categoryCapture.maincategory || 'all');
  const specificCategory: string = String(categoryCapture.subcategory || '');
  
  const hasSub = specificCategory && specificCategory !== 'all';
  const formatedMain = specficMainCategory.split('-').join(' ');
  const formatedSub = specificCategory.split('-').join(' ');

  const [loading, setLoading] = useState(true);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [dataChecked, setDataChecked] = useState(false);
  const categoryID = useRef<number>(0);
  const requestIdRef = useRef<number>(0);
  const [isMenu, setIsMenu] = useState(false);

  async function filterSubmit(e: any) {
    e.preventDefault();
    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    const minPrice = e.target.pricefrom?.value || '0';
    const maxPrice = e.target.priceto?.value || '10000';
    const rating = e.target.rating?.value || '1';

    // Update URL query parameters so filter survives page refresh and sharing
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('minPrice', minPrice);
      url.searchParams.set('maxPrice', maxPrice);
      url.searchParams.set('rating', rating);
      window.history.replaceState({}, '', url.toString());
    }

    const response = await subCategoryFilteredHandler({
      categoryID: categoryID.current,
      minPrice: parseFloat(minPrice),
      maxPrice: parseFloat(maxPrice),
      rating: parseFloat(rating),
      mainCategory: specficMainCategory,
      subCategory: specificCategory || undefined,
    });

    if (currentReqId === requestIdRef.current) {
      if (response.status === 200 && response.data?.data) {
        setProductsData(response.data.data);
      }
      setDataChecked(true);
      setLoading(false);
    }
  }

  async function fetchData() {
    const currentReqId = ++requestIdRef.current;
    setLoading(true);
    const paramMinPrice = searchParams.get('minPrice');
    const paramMaxPrice = searchParams.get('maxPrice');
    const paramRating = searchParams.get('rating');

    if (paramMinPrice !== null || paramMaxPrice !== null || paramRating !== null) {
      const response = await subCategoryFilteredHandler({
        categoryID: categoryID.current,
        minPrice: parseFloat(paramMinPrice || '0'),
        maxPrice: parseFloat(paramMaxPrice || '10000'),
        rating: parseFloat(paramRating || '1'),
        mainCategory: specficMainCategory,
        subCategory: specificCategory || undefined,
      });
      if (currentReqId === requestIdRef.current) {
        if (response.status === 200 && response.data?.data) {
          setProductsData(response.data.data);
        }
        setDataChecked(true);
        setLoading(false);
      }
    } else {
      const response = await subCategoryDataHandler(specficMainCategory, specificCategory);
      if (currentReqId === requestIdRef.current) {
        if (response.status === 200 && response.data?.data) {
          setProductsData(response.data.data);
          if (response.data.categoryid) {
            categoryID.current = response.data.categoryid;
          }
        }
        setDataChecked(true);
        setLoading(false);
      }
    }
  }

  function toggleClear() {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('minPrice');
      url.searchParams.delete('maxPrice');
      url.searchParams.delete('rating');
      window.history.replaceState({}, '', url.toString());
    }
    fetchData();
  }

  useEffect(() => {
    fetchData();
  }, [specficMainCategory, specificCategory]);

  return (
    <>
      <SearchMSidebar
        isMenu={isMenu}
        setIsMenu={setIsMenu}
        dataChecked={dataChecked}
        filterSubmit={filterSubmit}
        toggleClear={toggleClear}
      />
      <section className="flex flex-col gap-6 w-full max-w-7xl px-4 py-6">
        {/* Breadcrumb Bar */}
        <div className="flex items-center gap-2 text-xs md:text-sm text-slate-500 flex-wrap">
          <Link href="/" className="flex items-center gap-1 hover:text-[#0D94FB] transition-colors">
            <HomeIcon width={18} className="text-slate-400" />
            <span>Home</span>
          </Link>
          <ChevronDoubleRightIcon width={12} className="text-slate-300" />
          <Link href={`/categories/${specficMainCategory.toLowerCase()}`} className="capitalize hover:text-[#0D94FB] transition-colors">
            {formatedMain}
          </Link>
          {hasSub && (
            <>
              <ChevronDoubleRightIcon width={12} className="text-slate-300" />
              <span className="font-semibold capitalize text-slate-800">
                {formatedSub}
              </span>
            </>
          )}
        </div>

        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setIsMenu(true)}
          className="rounded-xl lg:hidden px-4 py-2.5 border border-[#0D94FB] font-semibold text-sm text-[#0D94FB] whitespace-nowrap w-[200px] mx-auto text-center shadow-xs transition-all hover:bg-[#0D94FB] hover:text-white cursor-pointer"
        >
          Filter Products
        </button>

        {/* Main Content Layout */}
        <section className="flex gap-8 items-start w-full">
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <FilterSidebar
                dataChecked={dataChecked}
                filterSubmit={filterSubmit}
                toggleClear={toggleClear}
                mobileMode={false}
              />
            </div>
          </aside>
          <SubProducts dataChecked={dataChecked} products={productsData} loading={loading} />
        </section>
      </section>
    </>
  );
};

export default SubCategory;