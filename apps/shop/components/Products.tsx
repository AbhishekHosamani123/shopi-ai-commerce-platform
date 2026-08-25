import React, { useEffect, useRef, useState } from 'react';
import Quickview from './ProductUi/Quickview';
import Stars from './ProductUi/Stars';
import NoProduct from './Search/NoProduct';
import Link from 'next/link';
import { homeProductsDataHandler } from '@/app/api/homeData';

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
  maincategory: string;
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

const defaultProduct: Product = {
  productid: 0,
  title: '',
  category: '',
  maincategory: '',
  price: '0.00',
  discount: '0.00',
  stars: 0,
  isnew: false,
  issale: false,
  isdiscount: false,
  colors: [],
  sizes: [],
  reviewCount: 0,
  images: {
    imageid: 0,
    imglink: '',
    imgalt: '',
  },
};

const ProductCardSkeleton = () => (
  <div className="flex flex-col border border-slate-100 rounded-xl w-[220px] p-2 space-y-3 animate-pulse">
    <div className="w-[200px] h-[210px] bg-slate-200 rounded-lg mx-auto" />
    <div className="w-1/3 h-3 bg-slate-200 rounded ml-2" />
    <div className="w-4/5 h-4 bg-slate-200 rounded ml-2" />
    <div className="w-1/2 h-5 bg-slate-200 rounded ml-2" />
  </div>
);

const ProductCard = ({ product }: { product: Product }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [productData, setproductData] = useState(defaultProduct);
  const [open, setOpen] = useState(false);

  function categoryLink(maincategory: string, category: string) {
    const splitCat = category ? category.split(' ').join('-') : 'all';
    return `/sub-category/${maincategory || 'all'}/${splitCat}`;
  }

  return (
    <div
      className="relative flex flex-col border border-slate-200 rounded-xl lg:max-h-[400px] w-[220px] p-2 overflow-hidden transition-shadow duration-300 hover:shadow-lg bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Quickview open={open} setOpen={setOpen} product={productData} />
      {product.issale && (
        <div className="absolute top-2 -left-8 bg-black text-white px-10 py-1 z-10 rotate-[320deg] text-[12px] uppercase rounded">
          SALE
        </div>
      )}
      {product.isnew && (
        <div className="absolute top-2 -left-8 bg-[#0D94FB] text-white px-10 py-1 z-10 rotate-[320deg] text-[12px] uppercase rounded">
          New
        </div>
      )}
      {product.isdiscount && (
        <div className="absolute top-2 left-2 bg-emerald-500 text-white px-2 text-xs font-bold uppercase rounded">
          {product.discount}%
        </div>
      )}
      <div className={`relative transition-transform mb-1 duration-300 ${isHovered && 'scale-105'} flex justify-center`}>
        <img
          className="w-[200px] h-[210px] object-cover rounded-lg"
          src={product.images.imglink}
          alt={product.title}
          loading="lazy"
          decoding="async"
          width={200}
          height={210}
        />
        {isHovered && (
          <button
            className="absolute bottom-2 left-1/2 rounded-xl transform -translate-x-1/2 w-[100px] h-[30px] flex items-center justify-center bg-black bg-opacity-60 hover:bg-opacity-80 text-white text-xs font-semibold uppercase transition-opacity duration-300 cursor-pointer"
            onClick={() => {
              setOpen(true);
              setproductData(product);
            }}
          >
            Quickview
          </button>
        )}
      </div>
      <div className="pl-2 pr-2 flex flex-col gap-1.5">
        <Link href={categoryLink(product.maincategory, product.category)} prefetch={true}>
          <p className="text-xs font-medium text-[#0D94FB] hover:underline uppercase tracking-wide truncate">
            {product.category}
          </p>
        </Link>
        <Link href={`/product/${product.productid}`} prefetch={true}>
          <p className="tracking-tight text-slate-800 hover:text-[#0D94FB] text-sm font-semibold truncate transition-colors">
            {product.title}
          </p>
        </Link>
        <div className="flex items-center gap-1.5">
          <Stars stars={product.stars} />
          {product.reviewCount > 0 && <p className="text-xs text-slate-400">({product.reviewCount})</p>}
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <p className="font-bold text-base text-slate-900">₹{product.discount}</p>
          <p className="line-through text-xs text-slate-400">₹{product.price}</p>
        </div>
      </div>
    </div>
  );
};

const Products = () => {
  const [dataChecked, setDataChecked] = useState(false);
  const [productList, setProductList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function sync() {
      const res = await homeProductsDataHandler();
      if (!isMounted) return;
      if (res.status === 200 && res.data?.data) {
        setProductList(res.data.data);
      }
      setDataChecked(true);
      setLoading(false);
    }
    sync();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="sm:ml-4 ml-auto mr-auto pb-8 max-w-[980px] flex flex-col flex-1">
      <p className="border-b-[1px] leading-[40px] tracking-wide font-semibold text-lg">Products</p>
      <div className="flex flex-wrap mt-8 gap-5 justify-center xl:w-[980px] lg:w-[720px] max-w-[980px] flex-1 relative">
        {loading && (
          <>
            {[...Array(6)].map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </>
        )}
        {dataChecked && !loading && productList.length === 0 && <NoProduct />}
        {dataChecked && !loading && productList.map((each, index) => (
          <ProductCard key={each.productid || index} product={each} />
        ))}
      </div>
    </div>
  );
};

export default Products;