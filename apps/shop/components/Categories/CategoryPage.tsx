import React, { useEffect, useState, useRef } from 'react';
import { HomeIcon, ChevronDoubleRightIcon } from '@heroicons/react/24/outline';
import CategoryProducts from './CategoryProducts';
import CategorySidebar from './CategorySidebar';
import { useParams } from 'next/navigation';
import FilterSidebar from '../FilterSidebar';
import categoryDataHandler from '@/app/api/mainCategory';
import { categoryFilterHandler, categoryOnlyFilterHandler } from '@/app/api/filter';
import CategoryMSidebar from '../Mobile-Interface/CategoryMSidebar';

interface categories {
  categoryid: number;
  name: string;
}

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

const CategoryPage = () => {
  const categoryCapture = useParams();
  const specificCategory: string | string[] = categoryCapture.category ?? '';
  const currDirectory = ['Categories', specificCategory];
  const [sidebarLoading, setsidebarLoading] = useState(true);
  const [loading, setloading] = useState(true);
  const [categoriesData, setCategoriesData] = useState<categories[]>([{ categoryid: 0, name: 'All' }]);
  const [productsData, setProductsData] = useState<Product[]>([]);
  const [dataChecked, setDataChecked] = useState(false);
  const [clear, setClear] = useState(false);
  const [isMenu, setIsMenu] = useState(false);
  const [selectedCategoryIndex, setselectedCategoryIndex] = useState<number>(0);

  async function filterSubmit(e: any) {
    e.preventDefault();
    setDataChecked(false);
    setloading(true);
    const values = {
      minPrice: e.target.pricefrom.value,
      maxPrice: e.target.priceto.value,
      rating: e.target.rating.value,
    };
    const response = await categoryFilterHandler({
      minPrice: values.minPrice,
      maxPrice: values.maxPrice,
      minRating: values.rating,
      categoryID: selectedCategoryIndex,
      categoryName: specificCategory,
    });
    if (response.status === 200 && response.data?.data) {
      setProductsData(response.data.data);
    }
    setDataChecked(true);
    setloading(false);
  }

  async function filterCategoryData() {
    setloading(true);
    const response = await categoryOnlyFilterHandler({
      categoryID: selectedCategoryIndex,
      categoryName: specificCategory,
    });
    if (response.status === 200 && response.data?.data) {
      setProductsData(response.data.data);
    }
    setDataChecked(true);
    setloading(false);
  }

  async function fetchData() {
    setloading(true);
    setsidebarLoading(true);
    const response = await categoryDataHandler(specificCategory);
    if (response.status === 200 && response.data?.data) {
      setCategoriesData([{ categoryid: 0, name: 'All' }, ...response.data.data.categories]);
      if (response.data.data.products?.length > 0) {
        setProductsData(response.data.data.products);
      }
    }
    setDataChecked(true);
    setsidebarLoading(false);
    setloading(false);
  }

  function toggleClear() {
    setClear(!clear);
  }

  useEffect(() => {
    fetchData();
  }, [specificCategory, clear]);

  useEffect(() => {
    if (dataChecked) {
      filterCategoryData();
    }
  }, [selectedCategoryIndex]);

  return (
    <>
      <CategoryMSidebar
        isMenu={isMenu}
        setIsMenu={setIsMenu}
        categoriesData={categoriesData}
        sidebarLoading={sidebarLoading}
        selectedCategoryIndex={selectedCategoryIndex}
        setselectedCategoryIndex={setselectedCategoryIndex}
        dataChecked={dataChecked}
        filterSubmit={filterSubmit}
        toggleClear={toggleClear}
      />
      <section className="flex flex-col gap-6 w-full max-w-7xl px-4 py-6">
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <HomeIcon width={20} className="text-slate-400" />
          {currDirectory.map((each, index) => (
            <div className="flex items-center gap-2" key={index}>
              <ChevronDoubleRightIcon width={14} className="text-slate-300" />
              <p className="font-medium capitalize text-slate-700">{each}</p>
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
            <CategorySidebar
              categories={categoriesData}
              loading={sidebarLoading}
              selectedCategoryIndex={selectedCategoryIndex}
              setselectedCategoryIndex={setselectedCategoryIndex}
              mobileMode={false}
            />
            <FilterSidebar
              dataChecked={dataChecked}
              filterSubmit={filterSubmit}
              toggleClear={toggleClear}
              mobileMode={false}
            />
          </div>
          <CategoryProducts dataChecked={dataChecked} products={productsData} loading={loading} />
        </section>
      </section>
    </>
  );
};

export default CategoryPage;