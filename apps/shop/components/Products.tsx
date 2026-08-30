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
  productid: number | string;
  title: string;
  category: string;
  maincategory: string;
  price: string;
  discount: string;
  discountedprice?: string;
  mrp?: number;
  selling_price?: number;
  discount_percentage?: number;
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

  const sellingPrice = product.selling_price || Number(product.discountedprice) || Number(product.price) || 0;
  const mrp = product.mrp || Number(product.price) || sellingPrice;
  const discountPct = (mrp > sellingPrice && mrp > 0)
    ? Math.round(((mrp - sellingPrice) / mrp) * 100)
    : (product.discount_percentage || 0);

  return (
    <div
      className="group relative flex flex-col border border-slate-200 rounded-xl w-[220px] p-2.5 transition-all duration-300 hover:shadow-lg bg-white"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Quickview open={open} setOpen={setOpen} product={productData} />
      {discountPct > 0 && (
        <div className="absolute top-2 left-2 bg-emerald-600 text-white px-2 py-0.5 text-[11px] font-bold uppercase rounded-md shadow-xs z-10 pointer-events-none">
          {discountPct}% OFF
        </div>
      )}
      {product.issale && (
        <div className="absolute top-2 right-2 bg-slate-900 text-white px-2 py-0.5 text-[10px] font-bold uppercase rounded-md shadow-xs z-10 pointer-events-none">
          SALE
        </div>
      )}
      {!product.issale && product.isnew && (
        <div className="absolute top-2 right-2 bg-[#0D94FB] text-white px-2 py-0.5 text-[10px] font-bold uppercase rounded-md shadow-xs z-10 pointer-events-none">
          NEW
        </div>
      )}
      <Link
        href={`/product/${product.productid}`}
        prefetch={true}
        className="relative block w-full h-[220px] bg-slate-50 rounded-lg flex items-center justify-center p-2 mb-2 overflow-hidden cursor-pointer"
      >
        <img
          className="w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-105"
          src={product.images.imglink}
          alt={product.title}
          loading="lazy"
          decoding="async"
        />
        {isHovered && (
          <button
            type="button"
            className="absolute bottom-2 left-1/2 rounded-xl transform -translate-x-1/2 w-[100px] h-[30px] flex items-center justify-center bg-black bg-opacity-75 hover:bg-opacity-95 text-white text-xs font-semibold uppercase transition-all duration-300 cursor-pointer shadow-md z-20"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen(true);
              setproductData(product);
            }}
          >
            Quickview
          </button>
        )}
      </Link>
      <div className="px-1 flex flex-col gap-1.5">
        <Link href={categoryLink(product.maincategory, product.category)} prefetch={true}>
          <p className="text-xs font-medium text-[#0D94FB] hover:underline uppercase tracking-wide truncate">
            {product.category}
          </p>
        </Link>
        <Link href={`/product/${product.productid}`} prefetch={true}>
          <p className="tracking-tight text-slate-800 hover:text-[#0D94FB] text-sm font-semibold line-clamp-2 min-h-[40px] transition-colors leading-snug">
            {product.title}
          </p>
        </Link>
        <div className="flex items-center gap-1.5">
          <Stars stars={product.stars} />
          {product.reviewCount > 0 && <p className="text-xs text-slate-400">({product.reviewCount})</p>}
        </div>
        <div className="flex items-baseline gap-2 mt-1 flex-wrap">
          <p className="font-bold text-base text-slate-900">₹{sellingPrice}</p>
          {mrp > sellingPrice && (
            <p className="line-through text-xs text-slate-400">₹{mrp}</p>
          )}
          {discountPct > 0 && (
            <span className="text-xs font-bold text-emerald-600">
              {discountPct}% OFF
            </span>
          )}
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