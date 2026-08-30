import React, { useState } from 'react';
import Quickview from '../ProductUi/Quickview';
import Stars from '../ProductUi/Stars';
import NoProduct from './NoProduct';
import Link from 'next/link';

interface Color {
  colorid: number;
  name?: string;
  colorname: string;
  colorclass: string;
  imglink?: string | null;
}

interface Size {
  sizeid: number;
  name?: string;
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
  maincategory?: string;
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

const defaultProduct: Product = {
  productid: 0,
  title: '',
  category: '',
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

const SubProductCardSkeleton = () => (
  <div className="flex flex-col border border-slate-100 rounded-xl w-full p-3 space-y-3 animate-pulse bg-white">
    <div className="w-full aspect-square bg-slate-200 rounded-lg" />
    <div className="w-1/3 h-3 bg-slate-200 rounded ml-1" />
    <div className="w-4/5 h-4 bg-slate-200 rounded ml-1" />
    <div className="w-1/2 h-5 bg-slate-200 rounded ml-1" />
  </div>
);

const ProductCard = ({ product }: { product: Product }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [productData, setproductData] = useState<Product>(product);
  const [open, setOpen] = useState(false);

  const prodSku = String(product.productid || product.sku || '');
  const sellingPrice = Number(product.selling_price || product.discountedprice || product.discount || product.price || 0);
  const mrp = Number(product.mrp || product.price || sellingPrice);
  const discountPct = (mrp > sellingPrice && mrp > 0)
    ? Math.round(((mrp - sellingPrice) / mrp) * 100)
    : Number(product.discount_percentage || 0);

  const fallbackImg = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&auto=format&fit=crop&q=60';
  const imgUrl = product.images?.imglink || fallbackImg;

  return (
    <div
      className="group relative flex flex-col justify-between border border-slate-200 rounded-xl w-full p-2.5 transition-all duration-300 hover:shadow-lg bg-white overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Quickview open={open} setOpen={setOpen} product={productData} />

      {/* Badges */}
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

      {/* Top Part: Image + Info */}
      <div className="flex flex-col flex-1">
        {/* Product Image Link */}
        <Link
          href={`/product/${prodSku}`}
          prefetch={true}
          className="relative block w-full aspect-square bg-slate-50 rounded-lg flex items-center justify-center p-2 mb-2 overflow-hidden cursor-pointer"
        >
          <img
            className="w-full h-full object-contain rounded-lg transition-transform duration-300 group-hover:scale-105"
            src={imgUrl}
            alt={product.images?.imgalt || product.title}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              if (target.src !== fallbackImg) {
                target.src = fallbackImg;
              }
            }}
          />
          {/* Quick View Button */}
          {isHovered && (
            <button
              type="button"
              className="absolute bottom-2 left-1/2 rounded-xl transform -translate-x-1/2 w-[100px] h-[30px] flex items-center justify-center bg-black/80 hover:bg-black text-white text-xs font-semibold uppercase transition-all duration-200 cursor-pointer shadow-md z-20"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setproductData(product);
                setOpen(true);
              }}
            >
              Quick View
            </button>
          )}
        </Link>

        {/* Content Info */}
        <div className="px-1 flex flex-col gap-1 flex-1">
          <Link href={`/product/${prodSku}`} prefetch={true}>
            <p className="text-xs font-semibold text-[#0D94FB] hover:underline uppercase tracking-wide truncate">
              {product.category || 'Apparel'}
            </p>
          </Link>
          <Link href={`/product/${prodSku}`} prefetch={true} className="flex-1">
            <h4 className="tracking-tight text-slate-800 hover:text-[#0D94FB] text-sm font-semibold line-clamp-2 min-h-[40px] transition-colors leading-snug">
              {product.title}
            </h4>
          </Link>
          <div className="flex items-center gap-1.5 mt-1">
            <Stars stars={product.stars} />
            {product.reviewCount > 0 && (
              <span className="text-xs text-slate-400">({product.reviewCount})</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Part: Pricing */}
      <div className="px-1 flex items-baseline gap-2 mt-2 pt-2 flex-wrap border-t border-slate-100">
        <span className="font-bold text-base text-slate-900">
          ₹{sellingPrice.toLocaleString('en-IN')}
        </span>
        {mrp > sellingPrice && (
          <span className="line-through text-xs text-slate-400">
            ₹{mrp.toLocaleString('en-IN')}
          </span>
        )}
        {discountPct > 0 && (
          <span className="text-xs font-bold text-emerald-600">
            {discountPct}% OFF
          </span>
        )}
      </div>
    </div>
  );
};

const SubProducts = ({
  dataChecked,
  products,
  loading,
}: {
  dataChecked: boolean;
  products: Product[];
  loading: boolean;
}) => {
  return (
    <div className="w-full flex flex-col flex-1 min-w-0 pb-8">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h2 className="leading-[32px] tracking-tight font-bold text-xl text-slate-900">Products</h2>
        <span className="text-xs md:text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {products.length} {products.length === 1 ? 'Product' : 'Products'}
        </span>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 w-full mt-6 transition-opacity duration-150 ${loading && products.length > 0 ? 'opacity-60' : 'opacity-100'}`}>
        {loading && products.length === 0 && (
          <>
            {[...Array(8)].map((_, i) => (
              <SubProductCardSkeleton key={i} />
            ))}
          </>
        )}
        {dataChecked && !loading && products.length === 0 && (
          <div className="col-span-full">
            <NoProduct />
          </div>
        )}
        {products.map((each, index) => (
          <ProductCard key={each.productid || each.sku || index} product={each} />
        ))}
      </div>
    </div>
  );
};

export default SubProducts;