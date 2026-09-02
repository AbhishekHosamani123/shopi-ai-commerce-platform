import React,{ useEffect, useLayoutEffect, useRef, useState } from 'react'
import Stars from './Stars'
import { ShoppingCartIcon, ReceiptRefundIcon, HeartIcon, CurrencyRupeeIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { useAppDispatch,useAppSelector } from '@/app/hooks'
import { addItemToCart,addItemToWishlist, setActiveProductContext, clearActiveProductContext } from '@/features/UIUpdates/CartWishlist'
import ReviewSection from './Product/ReviewSection'
import ProductNotFound from './Product/ProductNotFound'
import productDataHandler from '@/app/api/product'
import { useParams, useRouter } from 'next/navigation'
import Loading from '../Loading'
import Options from './Product/Options'
import { cartAddHandler,wishlistAddHandler } from '@/app/api/itemLists'
import { useApp } from '@/Helpers/AccountDialog'
import ProductDialogs from './ProductDialogs'
import Link from 'next/link'
// Interface for individual reviews
interface Review {
  reviewid: number;
  userid: number;
  rating: number;
  title:string;
  comment: string;
  username: string;
  createdat: string;
  productstars:number;
}

// Interface for images in imgcollection
interface ProductImage {
  imageid: number;
  imglink: string;
  imgalt: string;
}

// Interface for sizes
interface ProductSize {
  sizeid: number;
  sizename: string;
  instock: boolean;
  availableColors?: string[];
}

// Interface for colors
interface ProductColor {
  colorid: number;
  colorname: string;
  colorclass: string;
  imglink?: string | null;
  availableSizes?: string[];
}

// Interface for categories
interface Categories {
  subcategory: string;
  maincategory: string;
}

// Main interface for the product
interface Product {
  productid: number | string;
  title: string;
  description: string;
  stock: number;
  discountedprice: string;
  price: string;
  mrp?: number;
  selling_price?: number;
  discount_percentage?: number;
  stars: number;
  seller: string;
  reviewcount: number;
  categories: Categories;
  imglink: string;
  imgalt: string;
  imgcollection: ProductImage[] | [];
  colors: ProductColor[] | [];
  sizes: ProductSize[] | [];
  reviews: Review[] | [];
}
const defaultData = {
  productid:1,
  title: '',
  description: '',
  stock: 0,
  discountedprice: '',
  price: '',
  stars: 0,
  seller: '',
  reviewcount: 0,
  categories: {subcategory:'',maincategory:''},
  imglink: '',
  imgalt: '',
  imgcollection: [],
  colors: [],
  sizes: [],
  reviews: [],
}
const IDGenerator = ()=>{
  const ID = Math.round(Math.random() * 1000 * 1000 * 100);
  return ID;
}
const ProductPage = () => {
  const { appState } = useApp();
  const router = useRouter();
  const isLogged = appState.loggedIn;
    const [btnLoading, setbtnLoading] = useState(false);
    const ref = useRef<any>(null);
    const colRef = useRef<string>('Default');
    const sizeRef = useRef<string>('Default');
    const totalQuantity = useRef<number>(1);
    const found = useRef<boolean>(true);
    const [selectedRating, setselectedRating] = useState<number>(1);
    const dataVar = useRef<Product>(defaultData);
    const [selectedReview, setselectedReview] = useState<null|Review>(null)
    const data = dataVar.current;
    const [selectedColor, setSelectedColor] = useState<ProductColor>({colorid:0,colorname:'Default',colorclass:'col_default'});
    const [selectedSize, setSelectedSize] = useState<ProductSize>({sizeid:0,sizename:'Default',instock:true});
    const [selectedImage, setselectedImage] = useState({imgLink:'',imgAlt:''});
    const [quantity, setQuantity] = useState<number>(1);
    const params = useParams<{ productID: string }>()
    const [dataChecked, setdataChecked] = useState<boolean>(false);
    const [loading, setloading] = useState<boolean>(false);
    const [dialogType, setdialogType] = useState<null|string>(null)
    const dispatch = useAppDispatch();
    const defaultAccount = useAppSelector((state) => state.userState.defaultAccount)
    const listID = {cartItemID:IDGenerator(),wishlistItemID:IDGenerator()};

    const handleColorChange = (color: ProductColor) => {
      setSelectedColor(color);
      colRef.current = color.colorname;
      if (color.imglink) {
        setselectedImage({
          imgLink: color.imglink,
          imgAlt: `${dataVar.current.title} - ${color.colorname}`
        });
      } else {
        setselectedImage({
          imgLink: dataVar.current.imglink,
          imgAlt: dataVar.current.imgalt
        });
      }
    };

    let cartItemData = {
      cartItemID:listID.cartItemID,
      productID:data.productid,
      productImg:selectedImage.imgLink || data.imglink,
      productAlt:selectedImage.imgAlt || data.imgalt,
      productName:data.title,
      productPrice:parseInt(data.discountedprice || '0'),
      productColor:selectedColor.colorname !== 'Default' ? selectedColor.colorname : (colRef.current || 'Default'),
      productSize:selectedSize.sizename !== 'Default' ? selectedSize.sizename : (sizeRef.current || 'Default'),
      quantity: quantity,
    };
    let wishlistItem = {
      wishlistItemID:listID.wishlistItemID,
      productID:data.productid,
      productImg:selectedImage.imgLink || data.imglink,
      productAlt:selectedImage.imgAlt || data.imgalt,
      productName:data.title,
      productPrice:parseInt(data.discountedprice || '0'),
    };
    useEffect(() => {
      let isMounted = true;
      async function loadData() {
        if (!params?.productID) return;
        const response = await productDataHandler({ productID: params.productID });
        if (!isMounted) return;
        if (response.status === 200 && response.data?.data) {
          const prod = response.data.data;
          dataVar.current = prod;
          if (prod.stock !== undefined) totalQuantity.current = prod.stock;
          if (prod.colors?.length > 0) {
            setSelectedColor(prod.colors[0]);
            colRef.current = prod.colors[0].colorname;
            if (prod.colors[0].imglink) {
              setselectedImage({ imgLink: prod.colors[0].imglink, imgAlt: `${prod.title} - ${prod.colors[0].colorname}` });
            } else {
              setselectedImage({ imgLink: prod.imglink, imgAlt: prod.imgalt });
            }
          } else {
            setselectedImage({ imgLink: prod.imglink, imgAlt: prod.imgalt });
          }
          if (prod.sizes?.length > 0) {
            setSelectedSize(prod.sizes[0]);
            sizeRef.current = prod.sizes[0].sizename;
          }
          found.current = true;
        } else {
          found.current = false;
        }
          setdataChecked(true);
      }
      loadData();
      return () => {
        isMounted = false;
        dispatch(clearActiveProductContext());
      };
    }, [params?.productID]);

    useEffect(() => {
      if (dataVar.current && dataVar.current.title && dataChecked) {
        const activeColor = selectedColor.colorname !== 'Default' ? selectedColor.colorname : (colRef.current || 'Default');
        const activeSize = selectedSize.sizename !== 'Default' ? selectedSize.sizename : (sizeRef.current || 'Default');
        const activeImg = selectedImage.imgLink || dataVar.current.imglink;

        dispatch(setActiveProductContext({
          sku: String((dataVar.current as any).sku || dataVar.current.productid),
          title: dataVar.current.title,
          price: dataVar.current.selling_price || parseInt(dataVar.current.discountedprice || '0'),
          mrp: dataVar.current.mrp || parseInt(dataVar.current.price || '0'),
          category: dataVar.current.categories?.subcategory || dataVar.current.categories?.maincategory,
          selectedColor: activeColor !== 'Default' ? activeColor : undefined,
          selectedSize: activeSize !== 'Default' ? activeSize : undefined,
          selectedVariantImage: activeImg
        }));
      }
    }, [selectedColor, selectedSize, selectedImage, dataChecked]);
    
    const changeValue = (action:string)=>{
      switch (action) {
        case 'increase':
          (totalQuantity.current > quantity && 9 > quantity) && setQuantity(quantity+1);
          break;
        case 'decrease':
          quantity>1 && setQuantity(quantity-1);
          break;
      }
    }
    const handleClick = () => {
      ref.current?.scrollIntoView({behavior: 'smooth'});
    };
    function calculateDiscount(sp: number, mrp: number) {
      if (!mrp || mrp <= sp) return 0;
      return Math.round(((mrp - sp) / mrp) * 100);
    }
    async function itemStateUpdate(key:string){
      setbtnLoading(true);
      const activeColor = selectedColor.colorname !== 'Default' ? selectedColor.colorname : (colRef.current || 'Default');
      const activeSize = selectedSize.sizename !== 'Default' ? selectedSize.sizename : (sizeRef.current || 'Default');
      const activeImg = selectedImage.imgLink || data.imglink;

      const currentCartPayload = {
        ...cartItemData,
        productColor: activeColor,
        productSize: activeSize,
        productImg: activeImg,
        quantity
      };

      switch (key) {
        case 'cart':
        if (isLogged) {
          // Honest feedback: only commit the cart to the UI when the server
          // actually persisted it. Previously the ✓ showed and Redux updated
          // even when the backend rejected the insert (e.g. validation
          // error), so the cart "succeeded" until the next page load.
          const res = await cartAddHandler({cartItemID:listID.cartItemID,userID:defaultAccount.userID,productID:data.productid,productPrice:parseInt(data.discountedprice),colorID:selectedColor.colorid,sizeID:selectedSize.sizeid,quantity});
          if (res.status !== 200) {
            setbtnLoading(false);
            setdialogType('cartAddFailed');
            return;
          }
        }
        dispatch(addItemToCart(currentCartPayload));
        setbtnLoading(false)
          break;
        case 'wishlist':
        if (isLogged) {
          const res = await wishlistAddHandler({wishlistItemID:listID.wishlistItemID,userID:defaultAccount.userID,productID:data.productid});
          if (res.status !== 200) {
            setbtnLoading(false);
            setdialogType('cartAddFailed');
            return;
          }
        }
        dispatch(addItemToWishlist(wishlistItem));
        setbtnLoading(false);
          break;
      }
    }
    function categoryLink(maincategory:string,category:string){
      const splitCat = category.split(' ').join('-');
      return `/sub-category/${maincategory}/${splitCat}`
    }

    const sellingPrice = parseInt(data.discountedprice || '0') || data.selling_price || 0;
    const mrpPrice = parseInt(data.price || '0') || data.mrp || sellingPrice;
    const discountPct = calculateDiscount(sellingPrice, mrpPrice);

    return (
      <>
      <ProductDialogs dialogType={dialogType} setdialogType={setdialogType} setloading={setloading} productID={data.productid} selectedReview={selectedReview} selectedRating={selectedRating} setselectedRating={setselectedRating}/>
    <div className='flex flex-col gap-5 border-t-[1px] w-[100%]'>
      {!dataChecked && (
        <div className="w-full max-w-7xl mx-auto px-4 py-8 animate-pulse">
          <div className="w-48 h-4 bg-slate-200 rounded mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="flex flex-col gap-4 items-center">
              <div className="w-full max-w-[540px] aspect-square bg-slate-200 rounded-2xl" />
              <div className="flex gap-3 justify-center">
                <div className="w-16 h-16 bg-slate-200 rounded-lg" />
                <div className="w-16 h-16 bg-slate-200 rounded-lg" />
                <div className="w-16 h-16 bg-slate-200 rounded-lg" />
              </div>
            </div>
            <div className="flex flex-col gap-6 p-6 border border-slate-100 rounded-2xl">
              <div className="space-y-3">
                <div className="w-3/4 h-8 bg-slate-200 rounded-md" />
                <div className="w-1/3 h-4 bg-slate-200 rounded" />
              </div>
              <div className="flex items-baseline gap-4 py-4 border-y border-slate-100">
                <div className="w-32 h-10 bg-slate-200 rounded-md" />
              </div>
              <div className="space-y-4">
                <div className="w-24 h-4 bg-slate-200 rounded" />
                <div className="flex gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                  <div className="w-8 h-8 rounded-full bg-slate-200" />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <div className="w-48 h-12 bg-slate-200 rounded-xl" />
                <div className="w-48 h-12 bg-slate-200 rounded-xl" />
              </div>
            </div>
          </div>
        </div>
      )}
      {(dataChecked && !found.current) && <ProductNotFound />}
      {(dataChecked && data!=undefined && found.current) && <>
      <div className='flex items-center flex-col justify-center'>
            <div className='w-[80%] mb-5 mt-5'>
                <p>{data.categories.maincategory} {'>'} {data.categories.subcategory}</p>
            </div>
        </div>
        <div className='flex justify-center gap-10 flex-col items-center lg:flex-row max-w-7xl mx-auto px-4'>
            <div className='flex flex-col gap-4 w-full md:w-[500px] lg:w-[560px] items-center'>
                <div className='w-full max-w-[560px] h-[450px] sm:h-[500px] bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-4 overflow-hidden'>
                    <img 
                        className='max-w-full max-h-full object-contain rounded-xl transition-all duration-300' 
                        src={selectedImage.imgLink || data.imglink || undefined} 
                        alt={selectedImage.imgAlt || data.imgalt}
                    />
                </div>
                {data.imgcollection && data.imgcollection.length > 1 && (
                  <div className='flex gap-3 justify-center flex-wrap mt-2'>
                  {data.imgcollection.map((each, index) => (
                      <button 
                          key={index}
                          type="button"
                          className={`w-16 h-16 rounded-xl border-2 p-1 bg-slate-50 flex items-center justify-center transition-all cursor-pointer ${
                            (selectedImage.imgLink === each.imglink) ? 'border-[#0D94FB] shadow-md scale-105' : 'border-slate-200 hover:border-slate-400'
                          }`}
                          onClick={() => {
                              const imageDetails = { imgLink: each.imglink, imgAlt: each.imgalt };
                              setselectedImage(imageDetails);
                              const matchedColor = data.colors?.find(c => 
                                c.imglink === each.imglink || 
                                (c.colorname && each.imgalt && each.imgalt.toLowerCase().includes(c.colorname.toLowerCase()))
                              );
                              if (matchedColor) {
                                setSelectedColor(matchedColor);
                                colRef.current = matchedColor.colorname;
                              }
                          }}
                      >
                        <img 
                            src={each.imglink || undefined}
                            alt={each.imgalt}
                            className="max-w-full max-h-full object-contain"
                        />
                      </button>
                  ))}
                  </div>
                )}
            </div>
            <div className='flex flex-col gap-5 border-[1px] py-10 px-10 max-w-[90%] rounded-xl lg:max-w-[50%] w-auto'>
                <div className='border-b-[1px] pb-5 mb-2'>
                    <p className='text-3xl max-w-[600px] font-medium'>{data.title}</p>
                    <p className='text-silver'>By {data.seller}</p>
                    <div className="flex items-center">
                        <p className='mr-1 text-sm'>{data.stars}</p>
                        <Stars stars={data.stars}/>
                        <button onClick={handleClick} className="ml-3 text-sm font-medium text-indigo-600 hover:text-indigo-500">
                            {data.reviewcount} reviews
                        </button>
                    </div>
                </div>
                <div className='flex gap-4 items-baseline flex-wrap'>
                    <p className='font-bold text-3xl text-slate-900'>₹{sellingPrice}</p>
                    {mrpPrice > sellingPrice && <p className='line-through text-slate-400 text-xl'>₹{mrpPrice}</p>}
                    {discountPct > 0 && <span className='text-emerald-600 font-bold text-lg'>{discountPct}% OFF</span>}
                </div>
                <p><span className='font-semibold'>In stock</span>: Dispatch in 5 working days</p>
                <div className='flex gap-10 items-center'>
                    <p>Quantity</p>
                    <div className='flex items-center justify-center rounded-xl bg-gray-100'>
                        <button onClick={()=>changeValue('decrease')} className='w-[50px] text-4xl bg-gray-100 rounded-l-lg'>-</button>
                        <p className='bg-gray-100 w-[20px]'>{quantity}</p>
                        <button onClick={()=>changeValue('increase')} className='w-[40px] text-4xl bg-gray-100 rounded-r-lg'>+</button>
                    </div>
                    
                </div>
                {/*  */}
                  <Options sizes={data.sizes} colors={data.colors} selectedColor={selectedColor} setSelectedColor={setSelectedColor} selectedSize={selectedSize} setSelectedSize={setSelectedSize} colRef={colRef} sizeRef={sizeRef} cartItemData={cartItemData} onColorChange={handleColorChange}/>
                {/*  */}
                <div className='flex gap-5'>
                    <button disabled={btnLoading} onClick={()=>itemStateUpdate('cart')} className='w-[200px] h-[50px] bg-[#012652] text-white rounded-lg hover:bg-[#0D94FB] transition-colors duration-300 font-semibold'>
                    {btnLoading ? <div className="relative"><div className=''>
        <div className='drop-shadow-custom-xl rounded-xl w-[120px] mx-auto'>
            <div className="border-gray-300 my-auto mx-auto h-8 w-8 animate-spin rounded-full border-8 border-t-[#0D94FB]" />
        </div>
        
    </div></div> : "ADD TO CART"}
                      </button>
                    <button onClick={()=>router.push(`/checkout/${data.productid}/${selectedSize.sizeid}/${selectedColor.colorid}`)} className='w-[200px] h-[50px] rounded-lg font-semibold border-[#0D94FB] bg-[#0D94FB] text-white hover:bg-[#012652] hover:border-[#012652] transition-colors duration-300 border-[2px]'>BUY NOW</button>
                </div>
                <div className='flex gap-10 text-silver text-sm border-b-[1px] pb-10'>
                    <button disabled={btnLoading} onClick={()=>itemStateUpdate('wishlist')} className='flex hover:text-[#0D94FB] transition-colors duration-300 items-center gap-1 cursor-pointer'>
                        <HeartIcon width={25}/>
                        <div>{btnLoading ? <div className="relative"><div className=''>
                        <div className='drop-shadow-custom-xl rounded-xl w-[120px] mx-auto'>
                            <div className="border-gray-300 my-auto mx-auto h-8 w-8 animate-spin rounded-full border-8 border-t-[#0D94FB]" />
                        </div>
                        
                      </div></div> : "Add to wishlist"}</div>
                    </button>
                    <Link href={categoryLink(data.categories.maincategory,data.categories.subcategory)} className='flex hover:text-[#0D94FB] transition-colors duration-300 items-center gap-1 cursor-pointer'>
                        <GlobeAltIcon width={25}/>
                        <p>Find alternate products</p>
                    </Link>
                </div>
                {/* <p className='font-semibold mt-5'>Eligible for Delivery?</p>
                <div className='flex items-center gap-10 text-sm'>
                    <input className='bg-gray-100 w-[200px] h-[35px] rounded-md' type='number'/>
                    <p>The product is deliverable to this pincode</p>
                </div> */}
                <div className='flex gap-4 flex-wrap mb-10 border-b-[1px] pb-5 text-sm'>
                    <div className='flex gap-2'>
                        <div className='bg-blue-50 text-[#012652] rounded-full px-2 py-2'>
                        <ShoppingCartIcon width={30}/>
                        </div>
                        <p className='w-[135px]'>Get it by Thu, 20 Aug</p>
                    </div>
                    <div className='flex gap-2'>
                        <div className='bg-blue-50 text-[#012652] rounded-full px-2 py-2'>
                        <ReceiptRefundIcon width={30}/>
                        </div>
                        <p className='w-[135px]'>Easy returns available</p>
                    </div>
                    <div className='flex gap-1'>
                        <div className='bg-blue-50 text-[#012652] rounded-full px-2 py-2'>
                        <CurrencyRupeeIcon width={30}/>
                        </div>
                        <p className='w-[135px]'>Cash on delivery available</p>
                    </div>
                </div>
                <div className='flex flex-col gap-5'>
                    <p className='font-semibold'>Description:</p>
                    <p className='w-[600px]'>{data.description}</p>
                </div>
                
            </div>
        </div>
        <div ref={ref}>
          <ReviewSection data={data.reviews} setdialogType={setdialogType} setloading={setloading} reviewCount={data.reviewcount} setselectedReview={setselectedReview} setselectedRating={setselectedRating} allReview={false} productID={data.productid}/>
        </div>
      </>
      }
    </div>
    </>
  );
}

export default ProductPage