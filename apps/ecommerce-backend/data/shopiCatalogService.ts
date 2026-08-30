import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'storefront/apps/ecommerce-backend/.env') });
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ogppkxqvfzsusdawqbzx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');

export interface FormattedProductImage {
  imageid: number;
  imglink: string;
  imgalt: string;
  color?: string | null;
}

export interface FormattedProductColor {
  colorid: number;
  colorname: string;
  colorclass: string;
  imglink?: string | null;
  availableSizes?: string[];
}

export interface FormattedProductSize {
  sizeid: number;
  sizename: string;
  instock: boolean;
  availableColors?: string[];
}

export interface FormattedReview {
  reviewid: number;
  userid: number;
  rating: number;
  title: string;
  comment: string;
  username: string;
  createdat: string;
  productstars: number;
}

export interface FormattedProduct {
  productid: string | number;
  product_id?: number;
  id?: string | number;
  sku: string;
  title: string;
  name?: string;
  description: string;
  stock: number;
  discountedprice: string;
  discount?: string | number;
  price: string;
  discount_percentage: number;
  mrp: number;
  selling_price: number;
  stars: number;
  rating?: number;
  seller: string;
  brand: string;
  reviewcount: number;
  reviewCount?: number;
  categories: {
    maincategory: string;
    subcategory: string;
  };
  category?: string;
  maincategory?: string;
  imglink: string;
  imgalt: string;
  images: FormattedProductImage;
  imgcollection: FormattedProductImage[];
  colors: FormattedProductColor[];
  sizes: FormattedProductSize[];
  attributes?: any;
  review_summary?: any;
  product_type?: 'VARIANT_PRODUCT' | 'SIMPLE_PRODUCT';
  isnew?: boolean;
  issale?: boolean;
  isdiscount?: boolean;
}

// In-Memory Cache with 5-minute TTL
let catalogCache: {
  products: any[];
  variants: any[];
  images: any[];
  summaries: any[];
  attributes?: any[];
  reviews?: any[];
  scores?: any[];
  tags?: any[];
  lastFetched: number;
} | null = null;

let cachedProductCards: FormattedProduct[] | null = null;
const queryResultCache = new Map<string, { data: any; timestamp: number }>();

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchFromSupabase(table: string, queryParams: string = ''): Promise<any[]> {
  const url = `${cleanBaseUrl}/rest/v1/${table}${queryParams ? `?${queryParams}` : ''}`;
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${table}: [${res.status}] ${res.statusText}`);
  }
  return await res.json();
}

export function getColorClass(colorName: string): string {
  if (!colorName) return 'bg-slate-500';
  const c = colorName.toLowerCase();
  if (c.includes('black')) return 'bg-black text-white';
  if (c.includes('white')) return 'bg-white border-2 border-slate-300 text-black';
  if (c.includes('blue') || c.includes('navy')) return 'bg-blue-700 text-white';
  if (c.includes('red') || c.includes('maroon') || c.includes('crimson')) return 'bg-red-600 text-white';
  if (c.includes('green') || c.includes('olive') || c.includes('emerald')) return 'bg-emerald-600 text-white';
  if (c.includes('grey') || c.includes('gray') || c.includes('silver')) return 'bg-gray-400 text-white';
  if (c.includes('brown') || c.includes('tan') || c.includes('khaki') || c.includes('beige')) return 'bg-amber-800 text-white';
  if (c.includes('yellow')) return 'bg-yellow-400 text-black';
  if (c.includes('orange')) return 'bg-orange-500 text-white';
  if (c.includes('pink') || c.includes('rose')) return 'bg-pink-500 text-white';
  if (c.includes('purple') || c.includes('violet')) return 'bg-purple-600 text-white';
  if (c.includes('turquoise') || c.includes('teal')) return 'bg-teal-500 text-white';
  return 'bg-slate-700 text-white';
}

export class ShopiCatalogService {
  private static async getRawCatalog() {
    const now = Date.now();
    if (catalogCache && (now - catalogCache.lastFetched) < CACHE_TTL_MS) {
      return catalogCache;
    }

    // Fetch only the 4 tables required for catalog and listings (avoid heavy 800+ reviews table)
    const [
      products,
      variants,
      images,
      summaries
    ] = await Promise.all([
      fetchFromSupabase('shopi_products', 'select=product_id,sku,title,brand,department,category,subcategory,gender,short_description,description,mrp,selling_price,discount_percentage,currency,stock_quantity,is_available&order=product_id.asc'),
      fetchFromSupabase('shopi_product_variants', 'select=variant_id,product_id,color,size,variant_sku,stock_quantity,is_available,additional_options'),
      fetchFromSupabase('shopi_product_images', 'select=image_id,product_id,image_url,image_type,alt_text,is_primary,sort_order&order=sort_order.asc'),
      fetchFromSupabase('shopi_product_review_summary', 'select=product_id,average_rating,review_count')
    ]);

    catalogCache = {
      products,
      variants,
      images,
      summaries,
      lastFetched: now
    };

    // Pre-build lean product cards
    const validProds = products.filter((p: any) => p.sku !== 'SHOPI-TEST-001');
    cachedProductCards = validProds.map((p: any) => ShopiCatalogService.formatProductCard(p, catalogCache));
    queryResultCache.clear();

    return catalogCache;
  }

  public static formatProductCard(prod: any, catalog: any): FormattedProduct {
    const pId = prod.product_id;
    const sku = prod.sku || `PROD-${pId}`;

    const prodVariants = catalog.variants.filter((v: any) => v.product_id === pId);
    const prodImages = catalog.images.filter((img: any) => img.product_id === pId);
    const summary = catalog.summaries.find((s: any) => s.product_id === pId) || {};

    const primaryImg = prodImages.find((img: any) => img.is_primary) || prodImages[0] || {
      image_id: 1,
      image_url: prod.image_url || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg',
      alt_text: prod.title
    };

    const colorVariants: FormattedProductColor[] = [];
    const colorGroups = new Map<string, { colorName: string; variants: any[] }>();

    for (const v of prodVariants) {
      if (!v.color || v.color.toLowerCase() === 'null') continue;
      const cleanColor = v.color.trim();
      const lower = cleanColor.toLowerCase();
      if (!colorGroups.has(lower)) {
        colorGroups.set(lower, { colorName: cleanColor, variants: [v] });
      } else {
        colorGroups.get(lower)!.variants.push(v);
      }
    }

    for (const [lowerColor, group] of colorGroups) {
      const colorName = group.colorName;
      let imgUrl: string | null = null;

      // Priority 1: Match image in prodImages directly by alt_text
      const altMatch = prodImages.find((img: any) => {
        const alt = (img.alt_text || '').toLowerCase();
        return alt.endsWith(` - ${lowerColor}`) || alt.includes(`- ${lowerColor}`) || alt.includes(lowerColor);
      });
      if (altMatch) imgUrl = altMatch.image_url;

      // Priority 2: Match image in prodImages by URL filename
      if (!imgUrl) {
        const sanitizedColor = lowerColor.replace(/[^a-z0-9]/g, '');
        const urlMatch = prodImages.find((img: any) => {
          const cleanUrl = (img.image_url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanUrl.includes(sanitizedColor);
        });
        if (urlMatch) imgUrl = urlMatch.image_url;
      }

      // Priority 3: Check additional_options.image_url
      if (!imgUrl) {
        for (const v of group.variants) {
          if (v.additional_options?.image_url) {
            imgUrl = encodeURI(v.additional_options.image_url);
            break;
          }
        }
      }

      // Priority 4: Check additional_options.image_path matched against prodImages or public storage
      if (!imgUrl) {
        for (const v of group.variants) {
          if (v.additional_options?.image_path) {
            const rawPath = v.additional_options.image_path.toLowerCase();
            const matched = prodImages.find((img: any) => (img.image_url || '').toLowerCase().includes(rawPath));
            if (matched) {
              imgUrl = matched.image_url;
              break;
            }
            imgUrl = encodeURI(`${cleanBaseUrl}/storage/v1/object/public/shopi-product-images/${v.additional_options.image_path}`);
            break;
          }
        }
      }

      // Priority 5: Fallback to primary product image
      if (!imgUrl) {
        imgUrl = primaryImg.image_url;
      }

      const availableSizes = group.variants
        .filter((v: any) => v.size && v.size.toLowerCase() !== 'null' && v.is_available !== false && Number(v.stock_quantity || 0) > 0)
        .map((v: any) => v.size.trim());

      const firstVariant = group.variants[0];
      colorVariants.push({
        colorid: firstVariant.variant_id,
        colorname: colorName,
        colorclass: getColorClass(colorName),
        imglink: imgUrl,
        availableSizes: Array.from(new Set(availableSizes))
      });
    }

    const sizeVariants: FormattedProductSize[] = [];
    const sizeGroups = new Map<string, { sizeName: string; variants: any[] }>();
    for (const v of prodVariants) {
      if (!v.size || v.size.toLowerCase() === 'null') continue;
      const cleanSize = v.size.trim();
      const upper = cleanSize.toUpperCase();
      if (!sizeGroups.has(upper)) {
        sizeGroups.set(upper, { sizeName: cleanSize, variants: [v] });
      } else {
        sizeGroups.get(upper)!.variants.push(v);
      }
    }

    for (const [upperSize, group] of sizeGroups) {
      const sizeName = group.sizeName;
      const availableColors = group.variants
        .filter((v: any) => v.color && v.color.toLowerCase() !== 'null' && v.is_available !== false && Number(v.stock_quantity || 0) > 0)
        .map((v: any) => v.color.trim());

      const isAnyInStock = group.variants.some((v: any) => v.is_available !== false && Number(v.stock_quantity || 0) > 0);
      const firstVariant = group.variants[0];

      sizeVariants.push({
        sizeid: firstVariant.variant_id,
        sizename: sizeName,
        instock: isAnyInStock,
        availableColors: Array.from(new Set(availableColors))
      });
    }

    const avgRating = Number(summary.average_rating || 4.2);
    const revCount = Number(summary.review_count !== undefined ? summary.review_count : 18);

    const sellingPrice = Number(prod.selling_price || 0);
    const mrp = Number(prod.mrp || sellingPrice || 0);
    const calculatedDiscount = (mrp > sellingPrice && mrp > 0)
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : Number(prod.discount_percentage || 0);

    const isVariantProduct = prodVariants && prodVariants.length > 0;
    const computedStock = isVariantProduct
      ? prodVariants.reduce((sum: number, v: any) => {
          const isAvail = v.is_available !== false;
          const qty = Number(v.stock_quantity || 0);
          return sum + (isAvail && qty > 0 ? qty : 0);
        }, 0)
      : Number(prod.stock_quantity || 0);

    return {
      productid: sku,
      id: sku,
      sku: sku,
      title: prod.title,
      name: prod.title,
      description: prod.short_description || prod.description || '',
      stock: computedStock,
      product_type: isVariantProduct ? 'VARIANT_PRODUCT' : 'SIMPLE_PRODUCT',
      discountedprice: String(sellingPrice),
      price: String(mrp),
      discount: String(sellingPrice),
      discount_percentage: calculatedDiscount,
      mrp: mrp,
      selling_price: sellingPrice,
      stars: avgRating,
      rating: avgRating,
      seller: prod.brand || 'Razorpay AI Commerce',
      brand: prod.brand || 'Razorpay',
      reviewcount: revCount,
      reviewCount: revCount,
      categories: {
        maincategory: prod.department || 'Clothing',
        subcategory: prod.category || 'General'
      },
      category: prod.category || 'General',
      maincategory: prod.department || 'Clothing',
      imglink: primaryImg.image_url,
      imgalt: primaryImg.alt_text || prod.title,
      images: {
        imageid: primaryImg.image_id || 1,
        imglink: primaryImg.image_url,
        imgalt: primaryImg.alt_text || prod.title
      },
      imgcollection: [],
      colors: colorVariants,
      sizes: sizeVariants,
      reviews: [],
      isnew: calculatedDiscount < 30,
      issale: calculatedDiscount >= 50,
      isdiscount: calculatedDiscount > 0
    };
  }

  public static async formatProduct(prod: any, catalog: any): Promise<FormattedProduct> {
    const pId = prod.product_id;
    const sku = prod.sku || `PROD-${pId}`;

    const attrs = catalog.attributes.find((a: any) => a.product_id === pId) || {};
    const prodVariants = catalog.variants.filter((v: any) => v.product_id === pId);
    const prodImages = catalog.images.filter((img: any) => img.product_id === pId);
    const prodReviews = catalog.reviews.filter((r: any) => r.product_id === pId);
    const summary = catalog.summaries.find((s: any) => s.product_id === pId) || {};

    const primaryImg = prodImages.find((img: any) => img.is_primary) || prodImages[0] || {
      image_id: 1,
      image_url: 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg',
      alt_text: prod.title
    };

    const colorVariants: FormattedProductColor[] = [];
    const colorGroups = new Map<string, { colorName: string; variants: any[] }>();

    for (const v of prodVariants) {
      if (!v.color || v.color.toLowerCase() === 'null') continue;
      const cleanColor = v.color.trim();
      const lower = cleanColor.toLowerCase();
      if (!colorGroups.has(lower)) {
        colorGroups.set(lower, { colorName: cleanColor, variants: [v] });
      } else {
        colorGroups.get(lower)!.variants.push(v);
      }
    }

    for (const [lowerColor, group] of colorGroups) {
      const colorName = group.colorName;
      let imgUrl: string | null = null;

      // Priority 1: Match image in prodImages directly by alt_text
      const altMatch = prodImages.find((img: any) => {
        const alt = (img.alt_text || '').toLowerCase();
        return alt.endsWith(` - ${lowerColor}`) || alt.includes(`- ${lowerColor}`) || alt.includes(lowerColor);
      });
      if (altMatch) imgUrl = altMatch.image_url;

      // Priority 2: Match image in prodImages by URL filename
      if (!imgUrl) {
        const sanitizedColor = lowerColor.replace(/[^a-z0-9]/g, '');
        const urlMatch = prodImages.find((img: any) => {
          const cleanUrl = (img.image_url || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          return cleanUrl.includes(sanitizedColor);
        });
        if (urlMatch) imgUrl = urlMatch.image_url;
      }

      // Priority 3: Check additional_options.image_url
      if (!imgUrl) {
        for (const v of group.variants) {
          if (v.additional_options?.image_url) {
            imgUrl = encodeURI(v.additional_options.image_url);
            break;
          }
        }
      }

      // Priority 4: Check additional_options.image_path matched against prodImages or public storage
      if (!imgUrl) {
        for (const v of group.variants) {
          if (v.additional_options?.image_path) {
            const rawPath = v.additional_options.image_path.toLowerCase();
            const matched = prodImages.find((img: any) => (img.image_url || '').toLowerCase().includes(rawPath));
            if (matched) {
              imgUrl = matched.image_url;
              break;
            }
            imgUrl = encodeURI(`${cleanBaseUrl}/storage/v1/object/public/shopi-product-images/${v.additional_options.image_path}`);
            break;
          }
        }
      }

      // Priority 5: Fallback to primary product image
      if (!imgUrl) {
        imgUrl = primaryImg.image_url;
      }

      // Extract all in-stock sizes for this color
      const availableSizes = group.variants
        .filter((v: any) => v.size && v.size.toLowerCase() !== 'null' && v.is_available !== false && Number(v.stock_quantity || 0) > 0)
        .map((v: any) => v.size.trim());

      const firstVariant = group.variants[0];
      colorVariants.push({
        colorid: firstVariant.variant_id,
        colorname: colorName,
        colorclass: getColorClass(colorName),
        imglink: imgUrl,
        availableSizes: Array.from(new Set(availableSizes))
      });
    }

    const sizeVariants: FormattedProductSize[] = [];
    const sizeGroups = new Map<string, { sizeName: string; variants: any[] }>();
    for (const v of prodVariants) {
      if (!v.size || v.size.toLowerCase() === 'null') continue;
      const cleanSize = v.size.trim();
      const upper = cleanSize.toUpperCase();
      if (!sizeGroups.has(upper)) {
        sizeGroups.set(upper, { sizeName: cleanSize, variants: [v] });
      } else {
        sizeGroups.get(upper)!.variants.push(v);
      }
    }

    for (const [upperSize, group] of sizeGroups) {
      const sizeName = group.sizeName;
      const availableColors = group.variants
        .filter((v: any) => v.color && v.color.toLowerCase() !== 'null' && v.is_available !== false && Number(v.stock_quantity || 0) > 0)
        .map((v: any) => v.color.trim());

      const isAnyInStock = group.variants.some((v: any) => v.is_available !== false && Number(v.stock_quantity || 0) > 0);
      const firstVariant = group.variants[0];

      sizeVariants.push({
        sizeid: firstVariant.variant_id,
        sizename: sizeName,
        instock: isAnyInStock,
        availableColors: Array.from(new Set(availableColors))
      });
    }

    const imgCollection: FormattedProductImage[] = prodImages.map((img: any) => ({
      imageid: img.image_id,
      imglink: img.image_url,
      imgalt: img.alt_text || `${prod.title} Image`
    }));

    const formattedReviews: FormattedReview[] = prodReviews.map((r: any) => ({
      reviewid: r.review_id,
      userid: 1,
      rating: r.rating,
      title: r.review_title || 'Customer Review',
      comment: r.review_text || '',
      username: r.reviewer_name || 'Verified Buyer',
      createdat: r.review_date || new Date().toISOString().split('T')[0],
      productstars: Number(summary.average_rating || 4.0)
    }));

    const avgRating = Number(summary.average_rating || (formattedReviews.length > 0 ? (formattedReviews.reduce((sum: number, r: any) => sum + r.rating, 0) / formattedReviews.length).toFixed(1) : 4.0));
    const revCount = Number(summary.review_count !== undefined ? summary.review_count : formattedReviews.length);

    const sellingPrice = Number(prod.selling_price || 0);
    const mrp = Number(prod.mrp || sellingPrice || 0);
    const calculatedDiscount = (mrp > sellingPrice && mrp > 0)
      ? Math.round(((mrp - sellingPrice) / mrp) * 100)
      : Number(prod.discount_percentage || 0);

    const isVariantProduct = prodVariants && prodVariants.length > 0;
    const computedStock = isVariantProduct
      ? prodVariants.reduce((sum: number, v: any) => {
          const isAvail = v.is_available !== false;
          const qty = Number(v.stock_quantity || 0);
          return sum + (isAvail && qty > 0 ? qty : 0);
        }, 0)
      : Number(prod.stock_quantity || 0);

    return {
      product_id: prod.product_id,
      productid: sku,
      id: sku,
      sku: sku,
      title: prod.title,
      name: prod.title,
      description: prod.description || prod.short_description || '',
      stock: computedStock,
      product_type: isVariantProduct ? 'VARIANT_PRODUCT' : 'SIMPLE_PRODUCT',
      discountedprice: String(sellingPrice),
      price: String(mrp),
      discount: String(sellingPrice),
      discount_percentage: calculatedDiscount,
      mrp: mrp,
      selling_price: sellingPrice,
      stars: avgRating,
      rating: avgRating,
      seller: prod.brand || 'Razorpay AI Commerce',
      brand: prod.brand || 'Razorpay',
      reviewcount: revCount,
      reviewCount: revCount,
      categories: {
        maincategory: prod.department || 'Clothing',
        subcategory: prod.category || 'General'
      },
      category: prod.category || 'General',
      maincategory: prod.department || 'Clothing',
      imglink: primaryImg.image_url,
      imgalt: primaryImg.alt_text || prod.title,
      images: {
        imageid: primaryImg.image_id || 1,
        imglink: primaryImg.image_url,
        imgalt: primaryImg.alt_text || prod.title
      },
      imgcollection: imgCollection,
      colors: colorVariants,
      sizes: sizeVariants,
      reviews: formattedReviews,
      attributes: attrs,
      review_summary: summary,
      isnew: calculatedDiscount < 30,
      issale: calculatedDiscount >= 50,
      isdiscount: calculatedDiscount > 0
    };
  }

  public static async getProduct(identifier: string | number): Promise<FormattedProduct | null> {
    const catalog = await this.getRawCatalog();
    const strId = String(identifier).trim();
    const numId = Number(strId);

    const prod = catalog.products.find((p: any) => {
      if (p.sku && p.sku.toLowerCase() === strId.toLowerCase()) return true;
      if (Number.isFinite(numId) && p.product_id === numId) return true;
      return false;
    });

    if (!prod) return null;
    const pId = prod.product_id;

    // Fetch full reviews, attributes, and all images on-demand for this single product
    const [prodReviews, attrs, allImages] = await Promise.all([
      fetchFromSupabase('shopi_product_reviews', `select=*&product_id=eq.${pId}&order=review_date.desc`),
      fetchFromSupabase('shopi_product_attributes', `select=*&product_id=eq.${pId}`),
      fetchFromSupabase('shopi_product_images', `select=*&product_id=eq.${pId}&order=sort_order.asc`)
    ]);

    const detailedCatalog = {
      ...catalog,
      reviews: prodReviews,
      attributes: attrs,
      images: allImages.length > 0 ? allImages : catalog.images
    };

    return await this.formatProduct(prod, detailedCatalog);
  }

  public static async listProducts(): Promise<FormattedProduct[]> {
    if (cachedProductCards && catalogCache && (Date.now() - catalogCache.lastFetched) < CACHE_TTL_MS) {
      return cachedProductCards;
    }
    await this.getRawCatalog();
    return cachedProductCards || [];
  }

  public static async getHomeProducts(limit: number = 12): Promise<FormattedProduct[]> {
    const all = await this.listProducts();
    const shirts = all.filter(p => p.categories.subcategory === 'Shirts');
    const tshirts = all.filter(p => p.categories.subcategory === 'T-Shirt');
    const jeans = all.filter(p => p.categories.subcategory === 'Jeans');
    const jackets = all.filter(p => p.categories.subcategory === 'Jackets');
    const dresses = all.filter(p => p.categories.subcategory === 'Dresses');

    // Deterministic selection of fashion products: Shirts (4), T-Shirts (3), Jeans (3), Jackets (2)
    const homeSelection = [
      ...shirts.slice(0, 4),
      ...tshirts.slice(0, 3),
      ...jeans.slice(0, 3),
      ...jackets.slice(0, 2),
      ...dresses.slice(0, 2)
    ];

    return homeSelection.slice(0, limit);
  }

  public static async getTrending(limit: number = 8) {
    const all = await this.listProducts();
    const clothingFirst = [
      ...all.filter(p => p.categories.maincategory === 'Clothing'),
      ...all.filter(p => p.categories.maincategory === 'Footwear'),
      ...all.filter(p => p.categories.maincategory === 'Accessories')
    ];

    const trending = [...clothingFirst].sort((a, b) => b.stars - a.stars).slice(0, limit);
    const top_rated = [...clothingFirst].sort((a, b) => b.reviewcount - a.reviewcount).slice(0, limit);
    const new_arrival = [
      ...clothingFirst.filter(p => p.categories.subcategory === 'Shirts').slice(0, 2),
      ...clothingFirst.filter(p => p.categories.subcategory === 'T-Shirt').slice(0, 2),
      ...clothingFirst.filter(p => p.categories.subcategory === 'Jeans').slice(0, 2),
      ...clothingFirst.filter(p => p.categories.subcategory === 'Jackets').slice(0, 2),
      ...clothingFirst
    ].slice(0, limit);

    return { trending, top_rated, new_arrival };
  }

  public static async getBestSellers(limit: number = 4): Promise<FormattedProduct[]> {
    const all = await this.listProducts();
    const clothing = all.filter(p => p.categories.maincategory === 'Clothing');
    return [...clothing].sort((a, b) => (b.stars * b.reviewcount) - (a.stars * a.reviewcount)).slice(0, limit);
  }

  public static async getDeals(limit: number = 8): Promise<FormattedProduct[]> {
    const all = await this.listProducts();
    const clothing = all.filter(p => p.categories.maincategory === 'Clothing');
    return [...clothing].filter(p => p.discount_percentage >= 40).slice(0, limit);
  }

  public static matchesCategory(
    product: FormattedProduct,
    mainCategory?: string,
    subCategory?: string
  ): boolean {
    const pDept = product.categories?.maincategory || product.maincategory || '';
    const pCat = product.categories?.subcategory || product.category || '';
    const pTitle = product.title || '';

    const isWomen = pCat.toLowerCase() === 'dresses' || /\b(women|women's|womens|woman|ladies|girls)\b/i.test(pTitle);
    const isMen = !isWomen && (
      /\b(men|men's|mens|man|boys)\b/i.test(pTitle) ||
      ['shirts', 'jeans', 'jackets', 't-shirt', 'formal-shoes', 'sneakers', 'sports-shoes'].includes(pCat.toLowerCase())
    );

    if (mainCategory) {
      const mNorm = mainCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (mNorm && mNorm !== 'all') {
        if (mNorm === 'men' || mNorm === 'mens') {
          if (!isMen) return false;
        } else if (mNorm === 'women' || mNorm === 'womens') {
          if (!isWomen) return false;
        } else if (['clothing', 'clothes', 'fashion'].includes(mNorm)) {
          if (pDept.toLowerCase().replace(/[^a-z0-9]/g, '') !== 'clothing') return false;
        } else if (['footwear', 'shoes'].includes(mNorm)) {
          if (pDept.toLowerCase().replace(/[^a-z0-9]/g, '') !== 'footwear') return false;
        } else if (['accessories', 'bags'].includes(mNorm)) {
          if (pDept.toLowerCase().replace(/[^a-z0-9]/g, '') !== 'accessories') return false;
        } else {
          const pDeptNorm = pDept.toLowerCase().replace(/[^a-z0-9]/g, '');
          const pCatNorm = pCat.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (!pDeptNorm.includes(mNorm) && !mNorm.includes(pDeptNorm) && !pCatNorm.includes(mNorm) && !mNorm.includes(pCatNorm)) {
            return false;
          }
        }
      }
    }

    if (subCategory) {
      const sNorm = subCategory.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (sNorm && sNorm !== 'all') {
        const pCatNorm = pCat.toLowerCase().replace(/[^a-z0-9]/g, '');
        const sBase = sNorm.replace(/s$/, '');
        const pBase = pCatNorm.replace(/s$/, '');

        // Special distinction for shirt vs t-shirt
        const isTShirtQuery = sNorm.includes('tshirt') || sNorm.includes('tee');
        const isTShirtProduct = pCatNorm.includes('tshirt');

        if (isTShirtQuery !== isTShirtProduct && (sBase === 'shirt' || pBase === 'shirt' || isTShirtQuery || isTShirtProduct)) {
          return false;
        }

        const match = sNorm === pCatNorm ||
          sBase === pBase ||
          pCatNorm === sNorm + 's' ||
          sNorm === pCatNorm + 's' ||
          pCatNorm.includes(sNorm) ||
          sNorm.includes(pCatNorm);
        if (!match) return false;
      }
    }

    return true;
  }

  public static async searchProducts(
    queryText: string,
    minPrice?: number,
    maxPrice?: number,
    minRating?: number,
    mainCategory?: string,
    subCategory?: string
  ): Promise<FormattedProduct[]> {
    const all = await this.listProducts();
    const cleanQuery = (queryText || '').toLowerCase().trim();

    return all.filter(p => {
      if (mainCategory || subCategory) {
        if (!this.matchesCategory(p, mainCategory, subCategory)) return false;
      }

      if (cleanQuery && cleanQuery !== '0' && cleanQuery !== 'all') {
        const titleMatch = p.title.toLowerCase().includes(cleanQuery);
        const brandMatch = p.brand.toLowerCase().includes(cleanQuery);
        const catMatch = p.category?.toLowerCase().includes(cleanQuery) || p.maincategory?.toLowerCase().includes(cleanQuery);
        const descMatch = p.description.toLowerCase().includes(cleanQuery);
        if (!titleMatch && !brandMatch && !catMatch && !descMatch) return false;
      }

      if (minPrice !== undefined && !isNaN(minPrice) && p.selling_price < minPrice) return false;
      if (maxPrice !== undefined && !isNaN(maxPrice) && p.selling_price > maxPrice) return false;
      if (minRating !== undefined && !isNaN(minRating) && p.stars < minRating) return false;

      return true;
    });
  }

  public static async getByCategory(
    mainCategory?: string,
    subCategory?: string,
    options?: { minPrice?: number; maxPrice?: number; minRating?: number }
  ): Promise<FormattedProduct[]> {
    const cacheKey = `cat:${mainCategory || 'all'}:${subCategory || 'all'}:${options?.minPrice || 0}:${options?.maxPrice || 0}:${options?.minRating || 0}`;
    const now = Date.now();
    const cached = queryResultCache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_TTL_MS) {
      return cached.data;
    }

    const all = await this.listProducts();
    const results = all.filter(p => {
      if (!this.matchesCategory(p, mainCategory, subCategory)) {
        return false;
      }
      if (options?.minPrice !== undefined && !isNaN(options.minPrice) && p.selling_price < options.minPrice) return false;
      if (options?.maxPrice !== undefined && !isNaN(options.maxPrice) && p.selling_price > options.maxPrice) return false;
      if (options?.minRating !== undefined && !isNaN(options.minRating) && p.stars < options.minRating) return false;
      return true;
    });

    queryResultCache.set(cacheKey, { data: results, timestamp: now });
    return results;
  }
}

export default ShopiCatalogService;
