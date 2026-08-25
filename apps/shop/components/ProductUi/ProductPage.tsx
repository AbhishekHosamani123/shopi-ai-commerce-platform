import React,{ useEffect, useLayoutEffect, useRef, useState } from 'react'
import Stars from './Stars'
import { ShoppingCartIcon, ReceiptRefundIcon, HeartIcon, CurrencyRupeeIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { useAppDispatch,useAppSelector } from '@/app/hooks'
import { addItemToCart,addItemToWishlist } from '@/features/UIUpdates/CartWishlist'
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
}

// Interface for colors
interface ProductColor {
  colorid: number;
  colorname: string;
  colorclass: string;
}

// Interface for categories
interface Categories {
  subcategory: string;
  maincategory: string;
}

// Main interface for the product
interface Product {
  productid:number,
  title: string;
  description: string;
  stock: number;
  discountedprice: string;
  price: string;
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
    let cartItemData = {
      cartItemID:listID.cartItemID,
      productID:data.productid,
      productImg:data.imglink,
      productAlt:data.imgalt,
      productName:data.title,
      productPrice:parseInt(data.discountedprice),
      productColor:colRef.current,
      productSize:sizeRef.current,
      quantity: quantity,
    };
    let wishlistItem = {
      wishlistItemID:listID.wishlistItemID,
      productID:data.productid,
      productImg:data.imglink,
      productAlt:data.imgalt,
      productName:data.title,
      productPrice:parseInt(data.discountedprice),
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
          if (prod.colors?.length > 0) setSelectedColor(prod.colors[0]);
          if (prod.sizes?.length > 0) setSelectedSize(prod.sizes[0]);
          setselectedImage({ imgLink: prod.imglink, imgAlt: prod.imgalt });
          found.current = true;
        } else {
          found.current = false;
        }
        setdataChecked(true);
      }
      loadData();
      return () => {
        isMounted = false;
      };
    }, [params?.productID]);
    
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
    function percentageDifference(a:number, b:number) {
      const difference = Math.abs(a - b);
      const average = (a + b) / 2;
      const percentageDiff = (difference / average) * 100;
      return Math.round(percentageDiff);
    }
    async function itemStateUpdate(key:string){
      setbtnLoading(true);
      switch (key) {
        case 'cart':
        isLogged && await cartAddHandler({cartItemID:listID.cartItemID,userID:defaultAccount.userID,productID:data.productid,productPrice:parseInt(data.discountedprice),colorID:selectedColor.colorid,sizeID:selectedSize.sizeid,quantity})
        dispatch(addItemToCart(cartItemData));
        setbtnLoading(false)
          break;
        case 'wishlist':
        isLogged && await wishlistAddHandler({wishlistItemID:listID.wishlistItemID,userID:defaultAccount.userID,productID:data.productid})
        dispatch(addItemToWishlist(wishlistItem));
        setbtnLoading(false);
          break;
      }
    }
    function categoryLink(maincategory:string,category:string){
      const splitCat = category.split(' ').join('-');
      return `/sub-category/${maincategory}/${splitCat}`
    }
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
        <div className='flex justify-center gap-10 flex-col items-center lg:flex-row'>
            <div className='flex img-wrapper flex-col gap-5 w-[90%] md:w-[60%] px-2 lg:w-[600px] lg:h-[600px] rounded-xl items-center'>
                <img className='border-[1px] rounded-xl w-[100%] lg:w-[600px] lg:h-[600px] hover-zoom' src={selectedImage.imgLink || data.imglink || undefined} alt={selectedImage.imgAlt || data.imgalt}/>
                <div className='flex gap-5 justify-center'>
                {data.imgcollection.map((each, index) => (
                    <img 
                        key={index}
                        src={each.imglink || undefined}
                        alt={each.imgalt}
                        height={75}
                        width={75}
                        className="rounded-md border-[1px] hover:drop-shadow-custom-xl mb-6"
                        onClick={() => {
                            const imageDetails = { imgLink: each.imglink, imgAlt: each.imgalt };
                            setselectedImage(imageDetails);
                        }}
                    />
                ))}
                </div>
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
                <div className='flex gap-5 items-center'>
                    <p className='font-bold text-3xl'>₹{data.discountedprice}</p>
                    <p className='line-through'>₹{data.price}</p>
                    <p className='text-yellow-500'>{percentageDifference(parseInt(data.discountedprice),parseInt(data.price))}% off</p>
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
                  <Options sizes={data.sizes} colors={data.colors} selectedColor={selectedColor} setSelectedColor={setSelectedColor} selectedSize={selectedSize} setSelectedSize={setSelectedSize} colRef={colRef} sizeRef={sizeRef} cartItemData={cartItemData}/>
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