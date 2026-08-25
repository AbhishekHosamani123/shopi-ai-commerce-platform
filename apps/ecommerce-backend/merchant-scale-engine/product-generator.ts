import { client } from '../data/DB';

export type ProductBehaviorProfile = 
  | 'STAR_PRODUCT'
  | 'GROWING_PRODUCT'
  | 'DECLINING_PRODUCT'
  | 'SEASONAL_PRODUCT'
  | 'DEAD_STOCK'
  | 'VOLATILE_PRODUCT'
  | 'HIGH_RETURN_PRODUCT'
  | 'HIGH_MARGIN_PRODUCT'
  | 'LOW_MARGIN_PRODUCT'
  | 'STOCKOUT_PRONE_PRODUCT';

export interface SimProduct {
  productId: number;
  merchantId: string;
  title: string;
  category: string;
  subcategory?: string;
  price: number;
  cost: number;
  stock: number;
  behaviorProfile: ProductBehaviorProfile;
  returnProbability: number;
  seasonalityFactor: number;
  status: string;
}

const CATEGORIES = [
  { name: 'Apparel & Footwear', sub: ['Running Shoes', 'Jackets', 'Sneakers', 'Hoodies', 'Track Pants'] },
  { name: 'Electronics & Audio', sub: ['Wireless Earbuds', 'Smart Watches', 'Bluetooth Speakers', 'Cables'] },
  { name: 'Home & Kitchen', sub: ['Stainless Bottles', 'Cookware Sets', 'Coffee Makers', 'Storage Bins'] },
  { name: 'Beauty & Personal Care', sub: ['Face Serums', 'Moisturizers', 'Sunscreen SPF50', 'Hair Oils'] },
  { name: 'FMCG & Groceries', sub: ['Organic Green Tea', 'Protein Bars', 'Dry Fruits', 'Cold Brew Coffee'] }
];

const BEHAVIOR_PROFILES: ProductBehaviorProfile[] = [
  'STAR_PRODUCT',
  'GROWING_PRODUCT',
  'DECLINING_PRODUCT',
  'SEASONAL_PRODUCT',
  'DEAD_STOCK',
  'VOLATILE_PRODUCT',
  'HIGH_RETURN_PRODUCT',
  'HIGH_MARGIN_PRODUCT',
  'LOW_MARGIN_PRODUCT',
  'STOCKOUT_PRONE_PRODUCT'
];

export class ProductGenerator {
  /**
   * Generates a realistic catalog of products for a simulated merchant.
   */
  async generateCatalog(merchantId: string, count: number): Promise<SimProduct[]> {
    const products: SimProduct[] = [];

    // Clear existing simulation products for tenant
    await client.query('DELETE FROM sandbox_sim_products WHERE merchant_id = $1', [merchantId]);

    for (let i = 1; i <= count; i++) {
      const cat = CATEGORIES[i % CATEGORIES.length];
      const sub = cat.sub[i % cat.sub.length];
      const profile = BEHAVIOR_PROFILES[i % BEHAVIOR_PROFILES.length];

      // Realistic pricing & margin calculation based on profile
      let price = 1200 + ((i * 137) % 4800);
      let marginPct = 0.45; // 45% default margin

      if (profile === 'HIGH_MARGIN_PRODUCT') marginPct = 0.68;
      else if (profile === 'LOW_MARGIN_PRODUCT') marginPct = 0.18;
      else if (profile === 'DEAD_STOCK') price = 3500;

      const cost = Math.round(price * (1 - marginPct));

      // Return probability calibration
      let returnProb = 0.06;
      if (profile === 'HIGH_RETURN_PRODUCT') returnProb = 0.22;
      else if (profile === 'STAR_PRODUCT') returnProb = 0.03;

      // Stock allocation
      let stock = 80 + (i % 150);
      if (profile === 'DEAD_STOCK') stock = 300;
      else if (profile === 'STOCKOUT_PRONE_PRODUCT') stock = 8;

      const title = `${sub} - Pro Edition #${i}`;

      const res = await client.query(`
        INSERT INTO sandbox_sim_products (
          merchant_id, title, category, subcategory, price, cost, stock,
          behavior_profile, return_probability, seasonality_factor, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ACTIVE')
        RETURNING *;
      `, [
        merchantId,
        title,
        cat.name,
        sub,
        price,
        cost,
        stock,
        profile,
        returnProb,
        profile === 'SEASONAL_PRODUCT' ? 1.85 : 1.0
      ]);

      const r = res.rows[0];
      products.push({
        productId: r.product_id,
        merchantId: r.merchant_id,
        title: r.title,
        category: r.category,
        subcategory: r.subcategory,
        price: parseFloat(r.price),
        cost: parseFloat(r.cost),
        stock: r.stock,
        behaviorProfile: r.behavior_profile,
        returnProbability: parseFloat(r.return_probability),
        seasonalityFactor: parseFloat(r.seasonality_factor),
        status: r.status
      });
    }

    return products;
  }
}

export const productGenerator = new ProductGenerator();
