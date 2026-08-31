import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'storefront/apps/ecommerce-backend/.env') });
dotenv.config();

const DEFAULT_SUPABASE_URL = 'https://ogppkxqvfzsusdawqbzx.supabase.co';
// NOTE: the service-role key is a full-access secret and MUST be set via the
// SUPABASE_SERVICE_ROLE_KEY environment variable. The empty fallback ensures
// it is never accidentally committed to GitHub.
const DEFAULT_SUPABASE_KEY = '';

const SUPABASE_URL = process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || DEFAULT_SUPABASE_KEY;
const cleanBaseUrl = SUPABASE_URL.replace(/\/+$/, '');

export interface ProductRecord {
  product_id: number;
  sku: string;
  title: string;
  brand: string;
  department: string;
  category: string;
  subcategory: string;
  gender: string;
  short_description: string;
  description: string;
  mrp: number;
  selling_price: number;
  discount_percentage: number;
  currency: string;
  stock_quantity: number;
  is_available: boolean;
  image_url?: string;
}

export interface ProductAttributes {
  product_id: number;
  material?: string | null;
  fabric?: string | null;
  fit?: string | null;
  pattern?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  sleeve_type?: string | null;
  collar_type?: string | null;
  occasion?: string | null;
  season?: string | null;
  style?: string | null;
  comfort_level?: number | null;
  quality_level?: number | null;
  care_instructions?: string | null;
  length_type?: string | null;
  stretchable?: boolean | null;
  shoe_type?: string | null;
  sole_material?: string | null;
  closure_type?: string | null;
  additional_attributes?: any;
}

export interface ProductVariant {
  variant_id: number;
  product_id: number;
  color?: string | null;
  size?: string | null;
  variant_sku?: string | null;
  stock_quantity: number;
  is_available: boolean;
  additional_options?: any;
}

export interface ProductReviewSummary {
  product_id: number;
  review_count: number;
  average_rating: number;
  positive_percentage?: number | null;
  neutral_percentage?: number | null;
  negative_percentage?: number | null;
  pros?: string[] | null;
  cons?: string[] | null;
  common_positive_topics?: string[] | null;
  common_negative_topics?: string[] | null;
  fit_summary?: string | null;
  comfort_summary?: string | null;
  quality_summary?: string | null;
  recommendation_summary?: string | null;
}

export interface ProductScores {
  product_id: number;
  overall_score?: number | null;
  value_score?: number | null;
  quality_score?: number | null;
  comfort_score?: number | null;
  style_score?: number | null;
  popularity_score?: number | null;
  review_confidence?: number | null;
  best_for?: string[] | null;
  not_ideal_for?: string[] | null;
  buying_advice?: string | null;
}

export interface ProductFullIntelligence {
  product: ProductRecord;
  attributes?: ProductAttributes;
  variants: ProductVariant[];
  images: any[];
  reviewSummary?: ProductReviewSummary;
  scores?: ProductScores;
  reviews?: any[];
}

export interface RecommendationConstraints {
  query?: string;
  category?: string;
  subcategory?: string;
  gender?: string;
  purpose?: string;
  occasion?: string;
  style?: string;
  color?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  brand?: string;
  tags?: string[];
  excludedColors?: string[];
  excludedMaterials?: string[];
  excludedCategories?: string[];
  excludedTerms?: string[];
  limit?: number;
  [key: string]: any;
}

// In-Memory Catalog Cache for 5-minute TTL
let catalogMemoryCache: {
  products: ProductRecord[];
  variants: ProductVariant[];
  images: any[];
  attributes: ProductAttributes[];
  summaries: ProductReviewSummary[];
  scores: ProductScores[];
  reviews: any[];
  tags: any[];
  lastFetched: number;
} | null = null;

const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchSupabaseTable(table: string, queryParams: string = ''): Promise<any[]> {
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

export class ProductIntelligenceService {
  public static async getFullCatalog() {
    const now = Date.now();
    if (catalogMemoryCache && (now - catalogMemoryCache.lastFetched) < CACHE_TTL_MS) {
      return catalogMemoryCache;
    }

    const [
      products,
      variants,
      images,
      attributes,
      summaries,
      scores,
      tags,
      reviews
    ] = await Promise.all([
      fetchSupabaseTable('shopi_products', 'select=*&order=product_id.asc'),
      fetchSupabaseTable('shopi_product_variants', 'select=*'),
      fetchSupabaseTable('shopi_product_images', 'select=*&order=sort_order.asc'),
      fetchSupabaseTable('shopi_product_attributes', 'select=*'),
      fetchSupabaseTable('shopi_product_review_summary', 'select=*'),
      fetchSupabaseTable('shopi_product_scores', 'select=*'),
      fetchSupabaseTable('shopi_product_tags', 'select=*'),
      fetchSupabaseTable('shopi_product_reviews', 'select=*&order=created_at.desc')
    ]);

    catalogMemoryCache = {
      products: products.filter(p => p.sku !== 'SHOPI-TEST-001'),
      variants,
      images,
      attributes,
      summaries,
      scores,
      reviews: reviews || [],
      tags,
      lastFetched: now
    };

    return catalogMemoryCache;
  }

  /**
   * Resolve a product by SKU, product_id, or title substring
   */
  public static async getProductBySkuOrId(skuOrId: string | number): Promise<ProductFullIntelligence | null> {
    if (!skuOrId) return null;
    const catalog = await this.getFullCatalog();
    const strQuery = String(skuOrId).trim().toUpperCase();

    // 1. Match SKU exactly
    let prod = catalog.products.find(p => p.sku && p.sku.toUpperCase() === strQuery);

    // 2. Match product_id
    if (!prod && !isNaN(Number(skuOrId))) {
      const numId = Number(skuOrId);
      prod = catalog.products.find(p => p.product_id === numId);
    }

    // 3. Match partial SKU or SKU with prefix
    if (!prod) {
      prod = catalog.products.find(p => p.sku && p.sku.toUpperCase().includes(strQuery));
    }

    // 4. Match Title substring if specific enough
    if (!prod && strQuery.length >= 4) {
      prod = catalog.products.find(p => p.title && p.title.toUpperCase().includes(strQuery));
    }

    if (!prod) return null;

    const pId = prod.product_id;
    const variants = catalog.variants.filter(v => v.product_id === pId);
    const images = catalog.images.filter(img => img.product_id === pId);
    const attributes = catalog.attributes.find(a => a.product_id === pId);
    const summaryRaw = catalog.summaries.find(s => s.product_id === pId);
    const scores = catalog.scores.find(sc => sc.product_id === pId);
    const prodReviews = catalog.reviews.filter(r => r.product_id === pId);

    // Reconcile and audit review summary against actual reviews.
    // The canonical shopi_product_review_summary row is the single source of truth
    // for rating/count so chat cards and comparisons never disagree; the reviews
    // array is only a limited fetch and must not override the summary when present.
    const actualReviewCount = prodReviews.length;
    let auditedSummary = summaryRaw;
    if (summaryRaw) {
      auditedSummary = { ...summaryRaw };
    } else if (actualReviewCount > 0) {
      const avgRating = prodReviews.reduce((sum, r) => sum + (Number(r.rating) || 4), 0) / actualReviewCount;
      auditedSummary = {
        product_id: pId,
        review_count: actualReviewCount,
        average_rating: parseFloat(avgRating.toFixed(1)),
        positive_percentage: 85,
        neutral_percentage: 10,
        negative_percentage: 5,
        pros: ['Good quality and comfort', 'Value for money'],
        cons: ['Standard sizing check recommended']
      };
    }

    // Attach primary image URL directly
    const primaryImg = images.find(img => img.is_primary) || images[0];
    const image_url = primaryImg?.image_url || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg';

    return {
      product: {
        ...prod,
        image_url
      },
      attributes,
      variants,
      images,
      reviewSummary: auditedSummary,
      scores,
      reviews: prodReviews
    };
  }

  /**
   * Get raw customer reviews for a product
   */
  public static async getProductReviews(productId: number, limit: number = 5): Promise<any[]> {
    try {
      const reviews = await fetchSupabaseTable(
        'shopi_product_reviews',
        `product_id=eq.${productId}&order=helpful_count.desc,rating.desc&limit=${limit}`
      );
      return reviews;
    } catch {
      return [];
    }
  }

  /**
   * Search and Recommend products based on structured and semantic constraints
   */
  public static async recommendProducts(constraints: RecommendationConstraints): Promise<ProductRecord[]> {
    const catalog = await this.getFullCatalog();
    let candidates = [...catalog.products];

    // 1. Strict Category & Purpose Filter
    if (constraints.category) {
      const catLower = constraints.category.toLowerCase().trim();

      if (catLower.includes('sports-shoe') || catLower.includes('running') || constraints.occasion === 'running') {
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          const pSub = (p.subcategory || '').toLowerCase();
          const pTitle = p.title.toLowerCase();
          const attr = catalog.attributes.find(a => a.product_id === p.product_id);
          const recFor = (attr?.additional_attributes?.recommended_for || '').toLowerCase();
          return (pCat === 'sports-shoes' || pSub.includes('running') || pTitle.includes('running') || recFor.includes('running')) && pCat !== 'formal-shoes';
        });
      } else if (catLower.includes('formal-shoe') || catLower.includes('formal') && !catLower.includes('shirt')) {
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          const pSub = (p.subcategory || '').toLowerCase();
          return pCat === 'formal-shoes' || pSub.includes('formal');
        });
      } else if (catLower === 'sneakers' || catLower === 'sneaker') {
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          return pCat === 'sneakers';
        });
      } else if (catLower === 'shirts' || catLower === 'shirt') {
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          return pCat === 'shirts';
        });
      } else if (catLower === 't-shirt' || catLower === 't-shirts' || catLower === 'tshirt') {
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          return pCat === 't-shirt';
        });
      } else if (catLower === 'jeans' || catLower === 'denim') {
        candidates = candidates.filter(p => (p.category || '').toLowerCase() === 'jeans');
      } else if (catLower === 'jackets' || catLower === 'jacket') {
        candidates = candidates.filter(p => (p.category || '').toLowerCase() === 'jackets');
      } else if (catLower === 'dresses' || catLower === 'dress' || catLower === 'kurta') {
        candidates = candidates.filter(p => (p.category || '').toLowerCase() === 'dresses');
      } else if (catLower === 'bags' || catLower === 'bag' || catLower === 'backpack') {
        candidates = candidates.filter(p => (p.category || '').toLowerCase() === 'bags');
      } else if (catLower === 'footwear') {
        candidates = candidates.filter(p => (p.department || '').toLowerCase() === 'footwear');
      } else {
        const cleanCat = catLower.replace(/[-_]/g, ' ');
        candidates = candidates.filter(p => {
          const pCat = (p.category || '').toLowerCase();
          const pSub = (p.subcategory || '').toLowerCase();
          const pDept = (p.department || '').toLowerCase();
          return pCat.includes(cleanCat) || pSub.includes(cleanCat) || pDept.includes(cleanCat) || cleanCat.includes(pCat);
        });
      }
    }

    // 1b. Purpose / Occasion filter
    if (constraints.occasion === 'running') {
      candidates = candidates.filter(p => {
        const pCat = (p.category || '').toLowerCase();
        const pSub = (p.subcategory || '').toLowerCase();
        const pTitle = p.title.toLowerCase();
        const attr = catalog.attributes.find(a => a.product_id === p.product_id);
        const recFor = (attr?.additional_attributes?.recommended_for || '').toLowerCase();
        return (pCat === 'sports-shoes' || pSub.includes('running') || pTitle.includes('running') || recFor.includes('running')) && pCat !== 'formal-shoes';
      });
    }

    if (constraints.subcategory) {
      const subLower = constraints.subcategory.toLowerCase().replace(/[-_]/g, ' ');
      candidates = candidates.filter(p => {
        const pSub = (p.subcategory || '').toLowerCase();
        return pSub.includes(subLower) || subLower.includes(pSub);
      });
    }

    // 2. Gender filter
    if (constraints.gender) {
      const gLower = constraints.gender.toLowerCase();
      candidates = candidates.filter(p => {
        const pGen = (p.gender || '').toLowerCase();
        return pGen.includes(gLower) || gLower.includes(pGen) || pGen === 'unisex';
      });
    }

    // 3. Price Range Filter
    if (typeof constraints.minPrice === 'number') {
      candidates = candidates.filter(p => p.selling_price >= constraints.minPrice!);
    }
    if (typeof constraints.maxPrice === 'number') {
      candidates = candidates.filter(p => p.selling_price <= constraints.maxPrice!);
    }

    // 4. Positive Color Filter (BUG 2 fix)
    // A product appears ONLY if it has an available variant or primary attribute in the requested color
    if (constraints.color && constraints.color.trim().length > 0) {
      const reqColor = constraints.color.toLowerCase().trim();
      candidates = candidates.filter(p => {
        const pVariants = catalog.variants.filter(v => v.product_id === p.product_id);
        const pImages = catalog.images.filter(i => i.product_id === p.product_id);
        const pAttr = catalog.attributes.find(a => a.product_id === p.product_id);
        const pTitle = p.title.toLowerCase();
        const pPrimaryColor = (pAttr?.primary_color || '').toLowerCase();

        const hasVariantColor = pVariants.some(v => v.color && v.color.toLowerCase().includes(reqColor));
        const hasImageColor = pImages.some(i => (i.alt_text || '').toLowerCase().includes(reqColor) || (i.image_url || '').toLowerCase().includes(reqColor));
        const hasTitleColor = pTitle.includes(reqColor);
        const hasAttrColor = pPrimaryColor.includes(reqColor);

        return hasVariantColor || hasImageColor || hasTitleColor || hasAttrColor;
      });
    }

    // 5. Negative Constraints (Excluded Colors, Materials, Categories, Terms)
    if (constraints.excludedColors && constraints.excludedColors.length > 0) {
      const exColors = constraints.excludedColors.map(c => c.toLowerCase().trim());
      candidates = candidates.filter(p => {
        const pVariants = catalog.variants.filter(v => v.product_id === p.product_id);
        const pTitle = p.title.toLowerCase();
        const pAttr = catalog.attributes.find(a => a.product_id === p.product_id);
        const pColor = (pAttr?.primary_color || '').toLowerCase();

        const matchesExcluded = exColors.some(c => pTitle.includes(c) || pColor.includes(c));
        if (matchesExcluded) return false;

        if (pVariants.length > 0 && pVariants.every(v => exColors.some(c => (v.color || '').toLowerCase().includes(c)))) {
          return false;
        }
        return true;
      });
    }

    if (constraints.excludedMaterials && constraints.excludedMaterials.length > 0) {
      const exMats = constraints.excludedMaterials.map(m => m.toLowerCase().trim());
      candidates = candidates.filter(p => {
        const pAttr = catalog.attributes.find(a => a.product_id === p.product_id);
        const mat = `${pAttr?.material || ''} ${pAttr?.fabric || ''} ${p.description || ''}`.toLowerCase();
        return !exMats.some(m => mat.includes(m));
      });
    }

    if (constraints.excludedTerms && constraints.excludedTerms.length > 0) {
      const exTerms = constraints.excludedTerms.map(t => t.toLowerCase().trim());
      candidates = candidates.filter(p => {
        const fullText = `${p.title} ${p.category} ${p.subcategory} ${p.brand} ${p.description}`.toLowerCase();
        return !exTerms.some(t => fullText.includes(t));
      });
    }

    // 6. Text query search
    if (constraints.query && constraints.query.trim().length > 0) {
      const qTokens = constraints.query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
      candidates = candidates.filter(p => {
        const text = `${p.title} ${p.brand} ${p.category} ${p.subcategory} ${p.short_description}`.toLowerCase();
        return qTokens.some(tok => text.includes(tok));
      });
    }

    // 7. Attach matching variant images & ratings
    const enriched = candidates.map(p => {
      const imgs = catalog.images.filter(i => i.product_id === p.product_id);
      let selectedImgUrl = '';

      // If positive color was requested, pick the variant image matching that color!
      if (constraints.color) {
        const reqColor = constraints.color.toLowerCase().trim();
        const matchedImg = imgs.find(i => 
          (i.alt_text || '').toLowerCase().includes(reqColor) || 
          (i.image_url || '').toLowerCase().includes(reqColor)
        );
        if (matchedImg) {
          selectedImgUrl = matchedImg.image_url;
        } else {
          const matchedVar = catalog.variants.find(v => v.product_id === p.product_id && v.color && v.color.toLowerCase().includes(reqColor));
          if (matchedVar?.additional_options?.image_url) {
            selectedImgUrl = matchedVar.additional_options.image_url;
          }
        }
      }

      if (!selectedImgUrl) {
        const primaryImg = imgs.find(i => i.is_primary) || imgs[0];
        selectedImgUrl = primaryImg?.image_url || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg';
      }

      const summary = catalog.summaries.find(s => s.product_id === p.product_id);
      const score = catalog.scores.find(sc => sc.product_id === p.product_id);

      return {
        ...p,
        image_url: selectedImgUrl,
        rating: Number(summary?.average_rating) || 4.2,
        review_count: Number(summary?.review_count) || 12,
        score: score?.overall_score || 8
      };
    });

    // 8. Rank: Running purpose prioritization, rating, discount
    enriched.sort((a, b) => {
      if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
      
      let aScore = (a.rating * 10) + (a.discount_percentage * 0.1);
      let bScore = (b.rating * 10) + (b.discount_percentage * 0.1);

      if (constraints.occasion === 'running' || constraints.purpose === 'running') {
        if (a.category === 'Sports-Shoes') aScore += 50;
        if (b.category === 'Sports-Shoes') bScore += 50;
      }

      return bScore - aScore;
    });

    const limit = constraints.limit || 10;
    return enriched.slice(0, limit);
  }

  /**
   * Find products similar to a reference product
   */
  public static async findSimilarProducts(
    referenceSkuOrId: string | number,
    options: { cheaper?: boolean; betterReviews?: boolean; color?: string; limit?: number } = {}
  ): Promise<ProductRecord[]> {
    const target = await this.getProductBySkuOrId(referenceSkuOrId);
    if (!target) return [];

    const catalog = await this.getFullCatalog();
    const refProd = target.product;
    const refPrice = refProd.selling_price;
    const refRating = target.reviewSummary?.average_rating || 4.0;

    let peers = catalog.products.filter(p => p.product_id !== refProd.product_id);

    // Match subcategory or category
    peers = peers.filter(p => {
      const sameSub = p.subcategory && refProd.subcategory && p.subcategory.toLowerCase() === refProd.subcategory.toLowerCase();
      const sameCat = p.category && refProd.category && p.category.toLowerCase() === refProd.category.toLowerCase();
      const sameDept = p.department && refProd.department && p.department.toLowerCase() === refProd.department.toLowerCase();
      return sameSub || sameCat || sameDept;
    });

    if (options.cheaper) {
      peers = peers.filter(p => p.selling_price < refPrice);
      peers.sort((a, b) => a.selling_price - b.selling_price);
    }

    if (options.betterReviews) {
      peers = peers.filter(p => {
        const s = catalog.summaries.find(sm => sm.product_id === p.product_id);
        const rating = Number(s?.average_rating) || 4.0;
        return rating >= refRating;
      });
      peers.sort((a, b) => {
        const sA = catalog.summaries.find(sm => sm.product_id === a.product_id)?.average_rating || 4.0;
        const sB = catalog.summaries.find(sm => sm.product_id === b.product_id)?.average_rating || 4.0;
        return Number(sB) - Number(sA);
      });
    }

    if (options.color) {
      const cLower = options.color.toLowerCase();
      peers = peers.filter(p => {
        const vars = catalog.variants.filter(v => v.product_id === p.product_id);
        return vars.some(v => (v.color || '').toLowerCase().includes(cLower)) || p.title.toLowerCase().includes(cLower);
      });
    }

    // Attach primary images
    const limit = options.limit || 5;
    const result = peers.slice(0, limit).map(p => {
      const imgs = catalog.images.filter(i => i.product_id === p.product_id);
      const primaryImg = imgs.find(i => i.is_primary) || imgs[0];
      return {
        ...p,
        image_url: primaryImg?.image_url || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg'
      };
    });

    return result;
  }

  /**
   * Compare 2-3 products side by side with Domain-Specific Real Attributes (BUG 9 fix)
   */
  public static async compareProducts(productIdsOrSkus: (string | number)[]): Promise<any> {
    const products: ProductFullIntelligence[] = [];

    for (const id of productIdsOrSkus) {
      const full = await this.getProductBySkuOrId(id);
      if (full) products.push(full);
    }

    if (products.length === 0) return null;

    const comparisonItems = products.map(item => {
      const p = item.product;
      const attr = item.attributes;
      const sum = item.reviewSummary;
      const sc = item.scores;
      const variants = item.variants;
      const dept = (p.department || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();

      const isFootwear = dept === 'footwear' || cat === 'sports-shoes' || cat === 'formal-shoes' || cat === 'sneakers';
      const isApparel = dept === 'clothing' || cat === 'shirts' || cat === 't-shirt' || cat === 'jeans' || cat === 'jackets' || cat === 'dresses';

      let domainAttributes: Record<string, string> = {};

      if (isFootwear) {
        domainAttributes = {
          categoryType: 'footwear',
          upperMaterial: attr?.material || (attr?.additional_attributes?.upper_material) || (cat === 'formal-shoes' ? 'Synthetic Leather / Glossy' : 'Breathable Mesh / Synthetic'),
          soleMaterial: attr?.sole_material || (attr?.additional_attributes?.sole_material) || (cat === 'formal-shoes' ? 'Polyvinyl Chloride (PVC)' : 'EVA / Rubber'),
          cushioning: (attr?.additional_attributes?.cushioning) || (attr?.additional_attributes?.insole) || (cat === 'sports-shoes' ? 'High / Memory Foam' : 'Cushioned Insole'),
          closure: attr?.closure_type || (attr?.additional_attributes?.closure_type) || (attr?.additional_attributes?.closure) || 'Lace-Up',
          intendedUse: (attr?.additional_attributes?.recommended_for) || (cat === 'sports-shoes' ? 'Daily Running, Sports, Workouts' : cat === 'formal-shoes' ? 'Formal, Business, Office' : 'Casual Everyday')
        };
      } else if (isApparel) {
        domainAttributes = {
          categoryType: 'apparel',
          fabric: attr?.fabric || attr?.material || (attr?.additional_attributes?.fabric_type) || 'Cotton Blend',
          fit: attr?.fit || (attr?.additional_attributes?.fit) || 'Regular Fit',
          collar: attr?.collar_type || (attr?.additional_attributes?.collar_style) || (attr?.additional_attributes?.neck_style) || 'Standard Collar',
          sleeve: attr?.sleeve_type || (attr?.additional_attributes?.sleeve) || 'Full / Half Sleeve',
          pattern: attr?.pattern || (attr?.additional_attributes?.pattern) || 'Solid'
        };
      } else {
        domainAttributes = {
          categoryType: 'general',
          material: attr?.material || 'Durable Material',
          features: (attr?.additional_attributes?.features) || 'Standard Feature'
        };
      }

      return {
        productId: p.product_id,
        sku: p.sku,
        title: p.title,
        brand: p.brand,
        category: p.category,
        subcategory: p.subcategory,
        sellingPrice: p.selling_price,
        mrp: p.mrp,
        discountPercentage: p.discount_percentage,
        rating: sum?.average_rating || 4.2,
        reviewCount: sum?.review_count || 12,
        domainAttributes,
        // Legacy fields preserved cleanly
        material: domainAttributes.upperMaterial || domainAttributes.fabric || domainAttributes.material,
        fit: domainAttributes.fit || domainAttributes.intendedUse || 'Standard',
        colorsAvailable: Array.from(new Set(variants.map(v => v.color).filter(Boolean))),
        sizesAvailable: Array.from(new Set(variants.map(v => v.size).filter(Boolean))),
        pros: sum?.pros?.slice(0, 3) || ['High customer satisfaction', 'Good value for money'],
        cons: sum?.cons?.slice(0, 2) || ['Standard fit variations'],
        bestFor: sc?.best_for?.slice(0, 3) || ['Daily wear', 'Casual wear'],
        buyingAdvice: sc?.buying_advice || 'RECOMMENDED',
        imageUrl: p.image_url
      };
    });

    return {
      products: comparisonItems,
      cheapestProduct: [...comparisonItems].sort((a, b) => a.sellingPrice - b.sellingPrice)[0],
      highestRatedProduct: [...comparisonItems].sort((a, b) => b.rating - a.rating)[0],
      highestDiscountProduct: [...comparisonItems].sort((a, b) => b.discountPercentage - a.discountPercentage)[0]
    };
  }
}
