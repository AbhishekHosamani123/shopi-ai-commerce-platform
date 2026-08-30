import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogPanel, Radio, RadioGroup, Transition, TransitionChild } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { useAppDispatch,useAppSelector } from '@/app/hooks'
import { addItemToCart } from '@/features/UIUpdates/CartWishlist'
import Link from 'next/link'
import { useApp } from '@/Helpers/AccountDialog'
import { cartAddHandler } from '@/app/api/itemLists'
import Stars from './Stars'
function classNames(...classes:string[]) {
  return classes.filter(Boolean).join(' ')
}
interface Color {
    colorid:number;
    name?: string;
    colorname: string;
    colorclass: string;
    imglink?: string | null;
}

interface Size {
    sizeid:number;
    name?: string;
    sizename:string;
    instock: boolean;
}
interface ProductImage {
    imageid: number;
    imglink: string;
    imgalt: string;
}

// Interface for products
interface Product {
    productid: number | string;
    title: string;
    category: string;
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
    colors: Color[]; // assuming colors is an array of strings
    sizes: Size[];  // assuming sizes is an array of strings
    reviewCount: number;
    images: ProductImage;
}
interface ProductCardProps {
  product: Product;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}
const IDGenerator = ()=>{
  const ID = Math.round(Math.random() * 1000 * 1000 * 100);
  return ID;
}
export default function Quickview({ product, open, setOpen }: ProductCardProps) {
  // const [open, setOpen] = useState(false)
  const colRef = useRef<string>('Default');
  const sizeRef = useRef<string>('Default');
  const [btnLoading, setbtnLoading] = useState(false);
  const [selectedColor, setSelectedColor] = useState(product.colors.length===0 ? {colorid:0,name:'Default',colorname:'Default',colorclass:''} : product.colors[0]);
  const [selectedSize, setSelectedSize] = useState(product.sizes.length===0 ? {sizeid:0,name:'Default',sizename:'Default',instock:true} : product.sizes[0]);
  const [activeImg, setActiveImg] = useState({
    imglink: product.images?.imglink || '',
    imgalt: product.images?.imgalt || product.title
  });
  const { appState } = useApp();
  const dispatch = useAppDispatch();
  const defaultAccount = useAppSelector((state) => state.userState.defaultAccount)
  const listID = {cartItemID:IDGenerator()};

  const handleColorChange = (color: Color) => {
    setSelectedColor(color);
    colRef.current = color.colorname;
    if (color.imglink) {
      setActiveImg({
        imglink: color.imglink,
        imgalt: `${product.title} - ${color.colorname}`
      });
    } else {
      setActiveImg({
        imglink: product.images?.imglink || '',
        imgalt: product.images?.imgalt || product.title
      });
    }
  };

  const sellingPrice = product.selling_price || Number(product.discountedprice) || Number(product.discount) || Number(product.price) || 0;
  const mrpPrice = product.mrp || Number(product.price) || sellingPrice;
  const discountPct = (mrpPrice > sellingPrice && mrpPrice > 0)
    ? Math.round(((mrpPrice - sellingPrice) / mrpPrice) * 100)
    : (product.discount_percentage || 0);

  let cartItemData = {
    cartItemID:listID.cartItemID,
    productID:product.productid,
    productImg:activeImg.imglink || product.images.imglink,
    productAlt:activeImg.imgalt || product.images.imgalt,
    productName:product.title,
    productPrice:sellingPrice,
    productColor:colRef.current,
    productSize:sizeRef.current,
    quantity: 1,
  };
  const isLogged = appState.loggedIn;
  async function addCart(){
    setbtnLoading(true);
    isLogged && await cartAddHandler({cartItemID:listID.cartItemID,userID:defaultAccount.userID,productID:product.productid,productPrice:sellingPrice,colorID:selectedColor.colorid,sizeID:selectedSize.sizeid,quantity:1})
    dispatch(addItemToCart(cartItemData));
    setbtnLoading(false);
  }
  useEffect(() => {
    if (product.colors && product.colors.length > 0) {
      const initialColor = product.colors[0];
      setSelectedColor(initialColor);
      colRef.current = initialColor.colorname;
      if (initialColor.imglink) {
        setActiveImg({
          imglink: initialColor.imglink,
          imgalt: `${product.title} - ${initialColor.colorname}`
        });
      } else {
        setActiveImg({
          imglink: product.images?.imglink || '',
          imgalt: product.images?.imgalt || product.title
        });
      }
    } else {
      setActiveImg({
        imglink: product.images?.imglink || '',
        imgalt: product.images?.imgalt || product.title
      });
    }
    if (product.sizes && product.sizes.length > 0) {
      setSelectedSize(product.sizes[0]);
      sizeRef.current = product.sizes[0].sizename;
    }
  }, [open, product]);
  
  return (
    <Transition show={open}>
      <Dialog className="relative z-50" onClose={setOpen}>
        <TransitionChild
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 hidden bg-gray-500 bg-opacity-75 transition-opacity md:block" />
        </TransitionChild>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-stretch justify-center text-center md:items-center md:px-2 lg:px-4">
            <TransitionChild
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
              enterTo="opacity-100 translate-y-0 md:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 md:scale-100"
              leaveTo="opacity-0 translate-y-4 md:translate-y-0 md:scale-95"
            >
              <DialogPanel className="flex w-full transform text-left text-base transition md:my-8 md:max-w-2xl md:px-4 lg:max-w-4xl">
                <div className="relative flex w-full items-center overflow-hidden bg-white rounded-xl px-4 pb-8 pt-14 shadow-2xl sm:px-6 sm:pt-8 md:p-6 lg:p-8">
                  <button
                    type="button"
                    className="absolute right-4 top-4 text-gray-400 hover:text-gray-500 sm:right-6 sm:top-8 md:right-6 md:top-6 lg:right-8 lg:top-8"
                    onClick={() => setOpen(false)}
                  >
                    <span className="sr-only">Close</span>
                    <XMarkIcon className="h-6 w-6" aria-hidden="true" />
                  </button>

                  <div className="grid w-full grid-cols-1 items-start gap-x-6 gap-y-8 sm:grid-cols-12 lg:gap-x-8">
                    <div className="w-full h-[320px] rounded-lg bg-slate-50 flex items-center justify-center p-4 sm:col-span-4 lg:col-span-5">
                      <img src={activeImg.imglink || product.images.imglink} alt={activeImg.imgalt || product.images.imgalt} className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="sm:col-span-8 lg:col-span-7">
                      <h2 className="text-2xl font-bold text-gray-900 sm:pr-12">{product.title}</h2>

                      <section aria-labelledby="information-heading" className="mt-2">
                        <h3 id="information-heading" className="sr-only">
                          Product information
                        </h3>

                        <div className="flex items-baseline gap-3 mt-2 flex-wrap">
                          <p className="text-2xl font-bold text-gray-900">
                            ₹{sellingPrice}
                          </p>
                          {mrpPrice > sellingPrice && (
                            <p className="text-lg line-through text-gray-400">
                              ₹{mrpPrice}
                            </p>
                          )}
                          {discountPct > 0 && (
                            <span className="text-sm font-bold text-emerald-600">
                              {discountPct}% OFF
                            </span>
                          )}
                        </div>
                        <div className="mt-2">
                          <Link href={`/product/${product.productid}`} className="text-xs font-semibold text-[#0D94FB] hover:underline">
                            View Full Product Details & Reviews →
                          </Link>
                        </div>

                        {/* Reviews */}
                        <div className="mt-6">
                          <h4 className="sr-only">Reviews</h4>
                          <div className="flex items-center">
                            <Stars stars={product.stars}/>
                            <p className="sr-only">{product.stars} out of 5 stars</p>
                            <Link href={`/all-reviews/${product.productid}`} className="ml-3 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                              {product.reviewCount} reviews
                            </Link>
                          </div>
                        </div>
                      </section>

                      <section aria-labelledby="options-heading" className="mt-10">
                        <h3 id="options-heading" className="sr-only">
                          Product options
                        </h3>

                        <div>
                          {/* Colors */}
                        {product.colors.length != 0 && (
                          <fieldset aria-label="Choose a color">
                            <div className="flex items-center justify-between mb-3">
                              <legend className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                                <span>Color:</span>
                                <span className="font-bold text-[#0D94FB]">
                                  {selectedColor?.colorname ? selectedColor.colorname.split(' ').map(w => w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : ''}
                                </span>
                              </legend>
                              <span className="text-xs text-slate-400 font-medium">
                                {product.colors.length} {product.colors.length === 1 ? 'color' : 'colors'} available
                              </span>
                            </div>

                            <RadioGroup
                              value={selectedColor}
                              onChange={handleColorChange}
                              className="flex flex-wrap items-center gap-3"
                            >
                              {product.colors.map((color, index) => {
                                const formattedName = color.colorname ? color.colorname.split(' ').map(w => w === '&' ? '&' : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';
                                return (
                                  <Radio
                                    key={color.colorid || index}
                                    value={color}
                                    aria-label={`Color: ${formattedName}`}
                                    title={formattedName}
                                    className={({ focus, checked }) =>
                                      classNames(
                                        'group relative flex cursor-pointer items-center justify-center rounded-xl p-1 focus:outline-none transition-all duration-200 bg-slate-50 border',
                                        checked
                                          ? 'ring-2 ring-[#0D94FB] border-[#0D94FB] shadow-sm scale-105 bg-white'
                                          : 'border-slate-200 hover:border-[#0D94FB]/50 hover:shadow-xs',
                                        focus ? 'ring-2 ring-offset-1 ring-[#0D94FB]' : ''
                                      )
                                    }
                                  >
                                    {({ checked }) => (
                                      <div className="w-12 h-12 rounded-lg flex items-center justify-center p-1 overflow-hidden relative">
                                        {color.imglink ? (
                                          <img
                                            src={color.imglink}
                                            alt={formattedName}
                                            className="w-full h-full object-contain rounded-md transition-transform duration-200 group-hover:scale-105"
                                            loading="lazy"
                                          />
                                        ) : (
                                          <span
                                            aria-hidden="true"
                                            className={classNames(
                                              color.colorclass || 'bg-slate-700',
                                              'h-8 w-8 rounded-full border border-black/10 shadow-xs'
                                            )}
                                          />
                                        )}
                                        {checked && (
                                          <span className="absolute top-0.5 right-0.5 bg-[#0D94FB] text-white rounded-full w-3 h-3 flex items-center justify-center text-[8px] font-bold shadow-xs">
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </Radio>
                                );
                              })}
                            </RadioGroup>
                          </fieldset>
                        )}

                          {/* Sizes */}
                          {product.sizes.length != 0 &&<fieldset className="mt-10" aria-label="Choose a size">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-medium text-gray-900">Size</div>
                              <a href="#" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
                                Size guide
                              </a>
                            </div>

                            <RadioGroup
                              value={selectedSize}
                              onChange={setSelectedSize}
                              className="mt-4 grid grid-cols-4 gap-4"
                            >
                              {product.sizes.map((size,index) => (
                                <Radio
                                  key={index}
                                  value={size}
                                  disabled={!size.instock}
                                  className={({ focus }) =>
                                    classNames(
                                      size.instock
                                        ? 'cursor-pointer bg-white text-gray-900 shadow-sm'
                                        : 'cursor-not-allowed bg-gray-50 text-gray-200',
                                      focus ? 'ring-2 ring-indigo-500' : '',
                                      'group relative flex items-center justify-center rounded-md border py-3 px-4 text-sm font-medium uppercase hover:bg-gray-50 focus:outline-none sm:flex-1'
                                    )
                                  }
                                >
                                  {({ checked, focus }) => (
                                    <>
                                      <span>{size.sizename}</span>
                                      {size.instock ? (
                                        <span
                                          className={classNames(
                                            checked ? 'border-indigo-500' : 'border-transparent',
                                            focus ? 'border' : 'border-2',
                                            'pointer-events-none absolute -inset-px rounded-md'
                                          )}
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <span
                                          aria-hidden="true"
                                          className="pointer-events-none absolute -inset-px rounded-md border-2 border-gray-200"
                                        >
                                          <svg
                                            className="absolute inset-0 h-full w-full stroke-2 text-gray-200"
                                            viewBox="0 0 100 100"
                                            preserveAspectRatio="none"
                                            stroke="currentColor"
                                          >
                                            <line x1={0} y1={100} x2={100} y2={0} vectorEffect="non-scaling-stroke" />
                                          </svg>
                                        </span>
                                      )}
                                    </>
                                  )}
                                </Radio>
                              ))}
                            </RadioGroup>
                          </fieldset>
}
                          <button
                            onClick={addCart}
                            className="mt-6 flex w-full items-center justify-center rounded-md border border-transparent bg-[#012652] hover:bg-[#0D94FB] px-8 py-3 text-base font-medium text-white transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#0D94FB] focus:ring-offset-2"
                          >
                            {btnLoading ? <div className="relative"><div className=''>
                            <div className='drop-shadow-custom-xl rounded-xl w-[120px] mx-auto'>
                                <div className="border-gray-300 my-auto mx-auto h-8 w-8 animate-spin rounded-full border-8 border-t-[#0D94FB]" />
                            </div>
                            
                        </div></div> : "Add to bag"}
                          </button>
                          <div className='w-full flex justify-center mt-2'>
                          <Link href={`/product/${product.productid}`} className="text-sm font-medium text-[#0D94FB] hover:text-[#012652] transition-colors">
                              Go to Product Site
                          </Link>
                          </div>
                        </div>
                      </section>
                    </div>
                  </div>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}