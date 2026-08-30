/**
 * ⚡ RazorpayCommerceAdapter - Shopi AI Shopping Merchant Adapter
 * 
 * Implements MerchantAdapter interface to connect Shopi ShoppingAgent
 * directly to the real Razorpay AI Commerce PostgreSQL database (40 products, 69 categories).
 * 
 * Features:
 * - Real product catalog discovery (discover)
 * - Intelligent natural query search with keyword & price constraints (searchProducts)
 * - Paginated & categorized catalog browsing (listProducts)
 * - Detailed product retrieval with colors/sizes variants in INR (getProduct)
 * - Customer review analysis & ratings retrieval (getProductReviews)
 */

import { client } from '../data/DB';
import { rankAndFilterProducts, extractSemanticIntent } from './SemanticProductMatcher';
import ShopiCatalogService, { FormattedProduct } from '../data/shopiCatalogService';
import { ProductIntelligenceService } from '../shopi-assistant/productIntelligence';

export interface MoneyAmount {
  amount: string;
  currency: string;
}

export interface MockProduct {
  id: string;
  name: string;
  description: string;
  price: MoneyAmount;
  category?: string;
  inStock?: boolean;
  imageUrl?: string;
  variants?: Array<{
    id: string;
    name: string;
    price?: MoneyAmount;
  }>;
}

export interface ProductReview {
  id: string;
  author: string;
  rating: number;
  title?: string;
  body: string;
  date: string;
  verified?: boolean;
}

export interface ProductReviewResult {
  productId: string;
  averageRating: number;
  totalReviews: number;
  reviews: ProductReview[];
}

export interface RealCartItem {
  cartItemId: number;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
  imageUrl: string;
  category?: string;
  color?: string;
  size?: string;
  itemTotal: number;
}

export interface RealCartState {
  items: RealCartItem[];
  itemCount: number;
  total: number;
  currency: string;
}

export interface UserAddress {
  addressID: number;
  userID: number;
  addressType: string;
  userName: string;
  contactNumber: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  is_default: boolean;
}

export interface MerchantAdapterDiscovery {
  domain: string;
  name: string;
  protocol: 'adapter' | 'ucp';
  adapterType: string;
  capabilities: string[];
  ucpProfile?: unknown;
}

export interface MerchantAdapter {
  readonly adapterType: string;
  discover(domain: string): Promise<MerchantAdapterDiscovery>;
  listProducts(options?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<{ products: MockProduct[]; total: number }>;
  searchProducts(
    query: string,
    limit?: number
  ): Promise<{ products: MockProduct[]; total: number; query: string }>;
  getProduct(productId: string): Promise<MockProduct>;
  getProductReviews?(
    productId: string,
    limit?: number
  ): Promise<ProductReviewResult>;
}

export interface RazorpayCommerceAdapterOptions {
  domain?: string;
  merchantName?: string;
  defaultCurrency?: string;
}

export class RazorpayCommerceAdapter implements MerchantAdapter {
  readonly adapterType = 'razorpay-commerce';
  private readonly domain: string;
  private readonly merchantName: string;
  private readonly defaultCurrency: string;

  constructor(options: RazorpayCommerceAdapterOptions = {}) {
    this.domain = options.domain || 'localhost:3000';
    this.merchantName = options.merchantName || 'Razorpay AI Commerce';
    this.defaultCurrency = options.defaultCurrency || 'INR';
  }

  /**
   * Domain Matcher for Multi-Merchant Router
   */
  matchesDomain(domain: string): boolean {
    if (!domain) return true;
    const clean = domain.replace(/^https?:\/\//, '').replace(/\/+$/, '').toLowerCase();
    return clean === this.domain.toLowerCase() ||
           clean.includes('localhost') ||
           clean.includes('razorpay') ||
           clean.includes('shop') ||
           clean.includes('store') ||
           clean === 'default';
  }

  /**
   * 1. Discover Merchant Capabilities
   */
  async discover(domain?: string): Promise<MerchantAdapterDiscovery> {
    return {
      domain: domain || this.domain,
      name: this.merchantName,
      protocol: 'adapter',
      adapterType: this.adapterType,
      capabilities: [
        'catalog.browse',
        'catalog.search',
        'catalog.reviews',
        'catalog.variants',
        'cart.manage',
        'checkout.razorpay'
      ],
      ucpProfile: {
        version: '2026-01-01',
        capabilities: [
          { name: 'catalog', version: '1.0' },
          { name: 'cart', version: '1.0' },
          { name: 'checkout.razorpay', version: '1.0' }
        ]
      }
    };
  }

  private formatShopiProduct(p: FormattedProduct): MockProduct {
    const finalPrice = Number(p.selling_price || 0).toFixed(2);
    const variants: Array<{ id: string; name: string; price?: MoneyAmount }> = [];

    if (p.colors.length > 0 && p.sizes.length > 0) {
      for (const col of p.colors) {
        for (const sz of p.sizes) {
          variants.push({
            id: `${col.colorid}-${sz.sizeid}`,
            name: `${col.colorname} / ${sz.sizename}`,
            price: { amount: finalPrice, currency: this.defaultCurrency }
          });
        }
      }
    } else if (p.colors.length > 0) {
      for (const col of p.colors) {
        variants.push({
          id: String(col.colorid),
          name: col.colorname,
          price: { amount: finalPrice, currency: this.defaultCurrency }
        });
      }
    } else if (p.sizes.length > 0) {
      for (const sz of p.sizes) {
        variants.push({
          id: String(sz.sizeid),
          name: sz.sizename,
          price: { amount: finalPrice, currency: this.defaultCurrency }
        });
      }
    }

    return {
      id: String(p.sku || p.productid),
      name: p.title,
      description: p.description,
      price: {
        amount: finalPrice,
        currency: this.defaultCurrency
      },
      category: `${p.categories.maincategory} > ${p.categories.subcategory}`,
      inStock: p.stock > 0,
      imageUrl: p.imglink,
      variants
    };
  }

  /**
   * 2. List Products with Pagination and Optional Category Filtering
   */
  async listProducts(options?: {
    page?: number;
    limit?: number;
    category?: string;
  }): Promise<{ products: MockProduct[]; total: number }> {
    const page = Math.max(options?.page || 1, 1);
    const limit = Math.min(Math.max(options?.limit || 10, 1), 50);
    const offset = (page - 1) * limit;

    let allProds = await ShopiCatalogService.listProducts();

    if (options?.category && options.category.trim() !== '') {
      const catFilter = options.category.trim().toLowerCase();
      allProds = allProds.filter(p =>
        p.category?.toLowerCase().includes(catFilter) ||
        p.maincategory?.toLowerCase().includes(catFilter) ||
        p.categories.subcategory.toLowerCase().includes(catFilter) ||
        p.categories.maincategory.toLowerCase().includes(catFilter)
      );
    }

    const total = allProds.length;
    const paginated = allProds.slice(offset, offset + limit);
    const products = paginated.map(p => this.formatShopiProduct(p));

    return { products, total };
  }

  /**
   * 3. Natural Product Search (Supports keywords, categories, and price constraints)
   */
  async searchProducts(
    query: string,
    limit: number = 10
  ): Promise<{ products: MockProduct[]; total: number; query: string }> {
    const maxLimit = Math.min(Math.max(limit || 10, 1), 50);
    const rawQuery = (query || '').trim();

    // Extract price constraints if present
    let maxPriceConstraint: number | undefined = undefined;
    let minPriceConstraint: number | undefined = undefined;
    let cleanedKeywords = rawQuery;

    const underMatch = rawQuery.match(/(?:under|below|less than|within)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (underMatch && underMatch[1]) {
      maxPriceConstraint = parseFloat(underMatch[1]);
      cleanedKeywords = cleanedKeywords.replace(underMatch[0], ' ').trim();
    }

    const aboveMatch = rawQuery.match(/(?:above|over|more than|exceeding)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (aboveMatch && aboveMatch[1]) {
      minPriceConstraint = parseFloat(aboveMatch[1]);
      cleanedKeywords = cleanedKeywords.replace(aboveMatch[0], ' ').trim();
    }

    const matchedProds = await ShopiCatalogService.searchProducts(
      cleanedKeywords,
      minPriceConstraint,
      maxPriceConstraint
    );

    const rawCandidates: MockProduct[] = matchedProds.map(p => this.formatShopiProduct(p));
    const ranked = rankAndFilterProducts(rawCandidates, rawQuery);
    const finalProducts = ranked.length > 0 ? ranked.slice(0, maxLimit) : rawCandidates.slice(0, maxLimit);

    return {
      products: finalProducts,
      total: finalProducts.length,
      query: rawQuery
    };
  }

  /**
   * 4. Get Full Product Details by ID
   */
  async getProduct(productId: string): Promise<MockProduct> {
    const prod = await ShopiCatalogService.getProduct(productId);
    if (!prod) {
      throw new Error(`Product with ID "${productId}" was not found in catalog.`);
    }

    return this.formatShopiProduct(prod);
  }

  /**
   * 5. Get Product Reviews & Ratings
   */
  async getProductReviews(
    productId: string,
    limit: number = 10
  ): Promise<ProductReviewResult> {
    const maxLimit = Math.min(Math.max(limit || 10, 1), 50);
    const prod = await ShopiCatalogService.getProduct(productId);

    if (!prod) {
      return {
        productId: productId.toString(),
        averageRating: 4.0,
        totalReviews: 0,
        reviews: []
      };
    }

    const reviews: ProductReview[] = (prod.reviews || []).slice(0, maxLimit).map((r: any) => ({
      id: String(r.reviewid),
      author: r.username || 'Verified Customer',
      rating: Number(r.rating || 5),
      title: r.title || 'Product Review',
      body: r.comment || 'Verified customer review.',
      date: r.createdat || new Date().toISOString(),
      verified: true
    }));

    return {
      productId: productId.toString(),
      averageRating: prod.stars,
      totalReviews: prod.reviewcount,
      reviews
    };
  }

  /**
   * 6. Real Cart: Get Current Cart for User
   */
  async getCart(userId: number): Promise<RealCartState> {
    const query = `
      SELECT c.cartitemid, c.productid, c.quantity, c.colorid, c.sizeid,
             p.title, p.discount, p.price, p.stock,
             cat.name AS category_name, cat.maincategory,
             pi.imglink, pi.imgalt,
             pc.colorname,
             ps.sizename
      FROM cartitems c
      LEFT JOIN products p ON c.productid = p.productid
      LEFT JOIN categories cat ON p.categoryid = cat.categoryid
      LEFT JOIN (
        SELECT DISTINCT ON (productid) productid, imglink, imgalt
        FROM productimages
        ORDER BY productid, isprimary DESC
      ) pi ON p.productid = pi.productid
      LEFT JOIN (
        SELECT DISTINCT ON (productid, colorid) productid, colorid, colorname
        FROM productcolors
      ) pc ON c.colorid = pc.colorid AND c.productid = pc.productid
      LEFT JOIN (
        SELECT DISTINCT ON (productid, sizeid) productid, sizeid, sizename
        FROM productsizes
      ) ps ON c.sizeid = ps.sizeid AND c.productid = ps.productid
      WHERE c.userid = $1
      ORDER BY c.cartitemid ASC;
    `;

    const res = await client.query(query, [userId]);
    let total = 0;
    let itemCount = 0;

    const items: RealCartItem[] = await Promise.all(res.rows.map(async (row: any) => {
      // Look up canonical Supabase catalog product by numeric ID or SKU
      const supProd = await ShopiCatalogService.getProduct(String(row.productid));

      const canonicalSku = supProd?.sku || String(row.productid);
      const canonicalTitle = supProd?.title || row.title || 'Product';
      const unitPrice = supProd?.selling_price !== undefined 
        ? supProd.selling_price 
        : parseFloat(row.discount || row.price || 0);
      const qty = parseInt(row.quantity || 1, 10);
      const itemTotal = unitPrice * qty;

      total += itemTotal;
      itemCount += qty;

      // Color resolution: check row.colorname first, then match row.colorid in supProd.colors, fallback to first color
      let selectedColor = row.colorname;
      if (!selectedColor && row.colorid && supProd?.colors) {
        const matchedColById = supProd.colors.find((c: any) => c.colorid === row.colorid);
        if (matchedColById) selectedColor = matchedColById.colorname;
      }
      if (!selectedColor && supProd?.colors && supProd.colors.length > 0 && row.colorid) {
        selectedColor = supProd.colors[0].colorname;
      }
      if (selectedColor && (selectedColor.toLowerCase() === 'undefined' || selectedColor.toLowerCase() === 'null')) {
        selectedColor = undefined;
      }

      // Size resolution: check row.sizename first, then match row.sizeid in supProd.sizes, fallback to first size
      let selectedSize = row.sizename;
      if (!selectedSize && row.sizeid && supProd?.sizes) {
        const matchedSzById = supProd.sizes.find((s: any) => s.sizeid === row.sizeid);
        if (matchedSzById) selectedSize = matchedSzById.sizename;
      }
      if (!selectedSize && supProd?.sizes && supProd.sizes.length > 0 && row.sizeid) {
        selectedSize = supProd.sizes[0].sizename;
      }
      if (selectedSize && (selectedSize.toLowerCase() === 'undefined' || selectedSize.toLowerCase() === 'null')) {
        selectedSize = undefined;
      }

      // Image resolution: variant image first, then canonical image, then DB image
      let finalImg = supProd?.imglink || row.imglink;
      if (selectedColor && supProd?.colors) {
        const matchedCol = supProd.colors.find(c => c.colorname && c.colorname.toLowerCase() === selectedColor.toLowerCase());
        if (matchedCol && matchedCol.imglink) {
          finalImg = matchedCol.imglink;
        }
      }

      return {
        cartItemId: row.cartitemid,
        productId: canonicalSku,
        name: canonicalTitle,
        price: unitPrice,
        quantity: qty,
        currency: this.defaultCurrency,
        imageUrl: finalImg || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg',
        category: supProd?.category || row.category_name || row.maincategory || 'Clothing',
        color: selectedColor || undefined,
        size: selectedSize || undefined,
        itemTotal: parseFloat(itemTotal.toFixed(2)),
      };
    }));

    return {
      items,
      itemCount,
      total: parseFloat(total.toFixed(2)),
      currency: this.defaultCurrency,
    };
  }

  /**
   * 7. Real Cart: Add Product to Cart for User with Full Variant Support
   */
  async addToCart(
    userId: number,
    productId: string,
    quantity: number = 1,
    colorId?: number,
    sizeId?: number,
    colorName?: string,
    sizeName?: string
  ): Promise<{ success: boolean; message: string; cart: RealCartState; addedItem?: RealCartItem }> {
    const fullIntel = await ProductIntelligenceService.getProductBySkuOrId(productId);
    const supProd = await ShopiCatalogService.getProduct(productId);
    let id = parseInt(productId, 10);
    if (isNaN(id)) {
      if (fullIntel?.product?.product_id) {
        id = fullIntel.product.product_id;
      } else if (supProd && typeof (supProd as any).product_id === 'number') {
        id = (supProd as any).product_id;
      } else if (supProd && typeof supProd.productid === 'number') {
        id = supProd.productid;
      }
    }
    if (isNaN(id) || !id) {
      throw new Error(`Invalid product ID: "${productId}". Could not resolve to a catalog product.`);
    }

    const qty = Math.max(1, Math.min(quantity || 1, 10));

    // Ensure user exists in users table with required NOT NULL columns to prevent FK violation
    try {
      const userMobile = ('9' + String(Math.abs(userId)).padStart(9, '0')).slice(-10);
      await client.query(
        `INSERT INTO users (userid, email, username, password, mobile_number, dob)
         VALUES ($1, $2, $3, 'demo_secure_pass_2026', $4, '2000-01-01')
         ON CONFLICT (userid) DO NOTHING;`,
        [userId, `user_${userId}@shopi.ai`, `Customer ${userId}`, userMobile]
      );
    } catch (uErr: any) {
      console.warn('[User auto-provision warning]:', uErr.message);
    }

    // Verify product exists and is in stock
    const prodQuery = `
      SELECT p.productid, p.title, p.discount, p.price, p.stock,
             pi.imglink,
             (SELECT colorid FROM productcolors WHERE productid = p.productid LIMIT 1) AS default_colorid,
             (SELECT sizeid FROM productsizes WHERE productid = p.productid LIMIT 1) AS default_sizeid
      FROM products p
      LEFT JOIN productimages pi ON p.productid = pi.productid AND pi.isprimary = true
      WHERE p.productid = $1;
    `;

    let prodRes = await client.query(prodQuery, [id]);
    let prod = prodRes.rows[0];

    // Ensure product and all its colors and sizes are synced to local DB
    if (supProd) {
      try {
        await client.query(
          `INSERT INTO products (productid, title, price, discount, stock, description, categoryid)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (productid) DO UPDATE SET title = EXCLUDED.title, price = EXCLUDED.price, discount = EXCLUDED.discount, stock = EXCLUDED.stock;`,
          [
            id,
            supProd.title,
            supProd.mrp || supProd.price || 999,
            supProd.selling_price || supProd.discountedprice || 499,
            supProd.stock || 50,
            supProd.description || supProd.title,
            1
          ]
        );

        if (supProd.imglink) {
          await client.query(
            `INSERT INTO productimages (productid, imglink, imgalt, isprimary)
             VALUES ($1, $2, $3, true)
             ON CONFLICT DO NOTHING;`,
            [id, supProd.imglink, supProd.title]
          );
        }

        if (supProd.colors && supProd.colors.length > 0) {
          for (const col of supProd.colors) {
            await client.query(
              `INSERT INTO productcolors (colorid, productid, colorname, colorclass)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING;`,
              [col.colorid, id, col.colorname, col.colorclass || 'bg-slate-700']
            );
          }
        }

        if (supProd.sizes && supProd.sizes.length > 0) {
          for (const sz of supProd.sizes) {
            await client.query(
              `INSERT INTO productsizes (sizeid, productid, sizename, instock)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT DO NOTHING;`,
              [sz.sizeid, id, sz.sizename, sz.instock !== false]
            );
          }
        }

        const reQuery = await client.query(prodQuery, [id]);
        if (reQuery.rows.length > 0) {
          prod = reQuery.rows[0];
        }
      } catch (syncErr: any) {
        console.warn('[Sync Supabase product to DB warning]:', syncErr.message);
      }
    }

    if (!prod) {
      throw new Error(`Product with ID "${productId}" does not exist in catalog.`);
    }

    if (prod.stock !== null && prod.stock !== undefined && prod.stock <= 0) {
      throw new Error(`Product "${prod.title}" is currently out of stock.`);
    }

    // Resolve explicit color ID
    let finalColorId = colorId;
    if (finalColorId === undefined && colorName) {
      const colQuery = await client.query(
        `SELECT colorid FROM productcolors WHERE productid = $1 AND LOWER(colorname) = LOWER($2) LIMIT 1`,
        [id, colorName.trim()]
      );
      if (colQuery.rows.length > 0) {
        finalColorId = colQuery.rows[0].colorid;
      } else if (supProd?.colors) {
        const matchedCol = supProd.colors.find((c: any) => c.colorname && c.colorname.toLowerCase() === colorName.trim().toLowerCase());
        if (matchedCol?.colorid) finalColorId = matchedCol.colorid;
      }
    }
    if (finalColorId === undefined) {
      finalColorId = prod.default_colorid;
    }

    // Resolve explicit size ID
    let finalSizeId = sizeId;
    if (finalSizeId === undefined && sizeName) {
      const szQuery = await client.query(
        `SELECT sizeid FROM productsizes WHERE productid = $1 AND LOWER(sizename) = LOWER($2) LIMIT 1`,
        [id, sizeName.trim()]
      );
      if (szQuery.rows.length > 0) {
        finalSizeId = szQuery.rows[0].sizeid;
      } else if (supProd?.sizes) {
        const matchedSz = supProd.sizes.find((s: any) => s.sizename && s.sizename.toLowerCase() === sizeName.trim().toLowerCase());
        if (matchedSz?.sizeid) finalSizeId = matchedSz.sizeid;
      }
    }
    if (finalSizeId === undefined) {
      finalSizeId = prod.default_sizeid;
    }

    // Check if item with the EXACT same variant (color + size) is already in user's cart
    const checkQuery = `
      SELECT cartitemid, quantity 
      FROM cartitems 
      WHERE userid = $1 AND productid = $2 
        AND (colorid = $3 OR ($3 IS NULL AND colorid IS NULL))
        AND (sizeid = $4 OR ($4 IS NULL AND sizeid IS NULL));
    `;
    const checkRes = await client.query(checkQuery, [userId, id, finalColorId, finalSizeId]);

    if (checkRes.rows.length > 0) {
      const existingCartItemId = checkRes.rows[0].cartitemid;
      const updateQuery = `
        UPDATE cartitems 
        SET quantity = quantity + $1, updatedat = CURRENT_TIMESTAMP 
        WHERE cartitemid = $2 
        RETURNING cartitemid, quantity;
      `;
      await client.query(updateQuery, [qty, existingCartItemId]);
    } else {
      const insertQuery = `
        INSERT INTO cartitems (userid, productid, quantity, colorid, sizeid) 
        VALUES ($1, $2, $3, $4, $5) 
        RETURNING cartitemid, quantity;
      `;
      await client.query(insertQuery, [userId, id, qty, finalColorId, finalSizeId]);
    }

    const updatedCart = await this.getCart(userId);
    const addedItem = updatedCart.items.find(i => 
      (i.productId === (supProd?.sku || String(id))) &&
      (!colorName || (i.color || '').toLowerCase() === colorName.toLowerCase()) &&
      (!sizeName || (i.size || '').toLowerCase() === sizeName.toLowerCase())
    ) || updatedCart.items[updatedCart.items.length - 1];

    return {
      success: true,
      message: `Added "${prod.title}" (Qty: ${qty}) to your cart.`,
      cart: updatedCart,
      addedItem,
    };
  }

  /**
   * 8. Real Cart: Remove Product or Cart Item from User's Cart
   */
  async removeFromCart(
    userId: number,
    productIdOrCartItemId: string | number
  ): Promise<{ success: boolean; message: string; cart: RealCartState }> {
    let id = typeof productIdOrCartItemId === 'string' ? parseInt(productIdOrCartItemId, 10) : productIdOrCartItemId;
    let targetSku = typeof productIdOrCartItemId === 'string' ? productIdOrCartItemId : '';

    if (isNaN(id) && typeof productIdOrCartItemId === 'string') {
      const supProd = await ShopiCatalogService.getProduct(productIdOrCartItemId);
      if (supProd) {
        id = typeof (supProd as any).product_id === 'number'
          ? (supProd as any).product_id
          : (typeof supProd.productid === 'number' ? supProd.productid : 59);
        targetSku = supProd.sku || productIdOrCartItemId;
      }
    }

    const deleteQuery = `
      DELETE FROM cartitems 
      WHERE userid = $1 AND (productid = $2 OR cartitemid = $2 OR productid IN (SELECT productid FROM products WHERE title ILIKE $3))
      RETURNING cartitemid, productid;
    `;
    const res = await client.query(deleteQuery, [userId, id || -1, `%${targetSku || 'none'}%`]);

    const updatedCart = await this.getCart(userId);
    if (res.rows.length === 0) {
      return {
        success: false,
        message: `Item was not found in your cart.`,
        cart: updatedCart,
      };
    }

    return {
      success: true,
      message: `Item has been removed from your cart.`,
      cart: updatedCart,
    };
  }

  /**
   * 9. Real Cart: Update Product Quantity in User's Cart
   */
  async updateCartQuantity(
    userId: number,
    productIdOrCartItemId: string | number,
    newQuantity: number
  ): Promise<{ success: boolean; message: string; cart: RealCartState }> {
    const id = typeof productIdOrCartItemId === 'string' ? parseInt(productIdOrCartItemId, 10) : productIdOrCartItemId;
    if (isNaN(id)) {
      throw new Error(`Invalid ID: "${productIdOrCartItemId}".`);
    }

    if (newQuantity <= 0) {
      return this.removeFromCart(userId, id);
    }

    const qty = Math.min(newQuantity, 10);
    const updateQuery = `
      UPDATE cartitems 
      SET quantity = $1, updatedat = CURRENT_TIMESTAMP 
      WHERE userid = $2 AND (productid = $3 OR cartitemid = $3)
      RETURNING cartitemid, quantity;
    `;

    const res = await client.query(updateQuery, [qty, userId, id]);
    const updatedCart = await this.getCart(userId);

    if (res.rows.length === 0) {
      return {
        success: false,
        message: `Item was not found in your cart.`,
        cart: updatedCart,
      };
    }

    return {
      success: true,
      message: `Cart quantity updated to ${qty}.`,
      cart: updatedCart,
    };
  }

  /**
   * 9b. Clear All Items in User's Cart
   */
  async clearCart(userId: number): Promise<{ success: boolean; message: string; cart: RealCartState }> {
    await client.query('DELETE FROM cartitems WHERE userid = $1', [userId]);
    const updatedCart = await this.getCart(userId);
    return {
      success: true,
      message: 'Your cart has been cleared.',
      cart: updatedCart,
    };
  }

  /**
   * 10. Real Addresses: Get All Saved Addresses for a User
   */
  async getUserAddresses(userId: number): Promise<UserAddress[]> {
    const query = `
      SELECT addressid, userid, addresstype, contactnumber, addressline1, addressline2,
             city, state, country, postalcode, username, is_default
      FROM addresses
      WHERE userid = $1
      ORDER BY is_default DESC, addressid ASC;
    `;
    const res = await client.query(query, [userId]);
    return res.rows.map(row => ({
      addressID: row.addressid,
      userID: row.userid,
      addressType: row.addresstype || 'HOME',
      userName: row.username || 'Valued Customer',
      contactNumber: row.contactnumber ? String(row.contactnumber) : '',
      addressLine1: row.addressline1 || '',
      addressLine2: row.addressline2 || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || 'India',
      postalCode: row.postalcode || '',
      is_default: Boolean(row.is_default),
    }));
  }

  /**
   * 11. Real Addresses: Get Default / Primary Address for a User
   */
  async getDefaultAddress(userId: number): Promise<UserAddress | null> {
    const addresses = await this.getUserAddresses(userId);
    if (addresses.length === 0) return null;
    const defaultAddr = addresses.find(a => a.is_default);
    return defaultAddr || addresses[0];
  }

  /**
   * Helper: Format Database Product Row into Standard Product Object
   */
  private async formatProductRow(row: any, includeVariants: boolean = false): Promise<MockProduct> {
    const productId = row.productid;
    const finalPrice = parseFloat(row.discount || row.price || '0').toFixed(2);

    let variants: Array<{ id: string; name: string; price?: MoneyAmount }> = [];

    if (includeVariants) {
      const [colorRes, sizeRes] = await Promise.all([
        client.query(`SELECT colorid, colorname FROM productcolors WHERE productid = $1;`, [productId]),
        client.query(`SELECT sizeid, sizename, instock FROM productsizes WHERE productid = $1;`, [productId])
      ]);

      const colors = colorRes.rows;
      const sizes = sizeRes.rows;

      if (colors.length > 0 && sizes.length > 0) {
        for (const col of colors) {
          for (const sz of sizes) {
            variants.push({
              id: `${col.colorid}-${sz.sizeid}`,
              name: `${col.colorname || 'Standard'} / ${sz.sizename || 'One Size'}`,
              price: { amount: finalPrice, currency: this.defaultCurrency }
            });
          }
        }
      } else if (sizes.length > 0) {
        variants = sizes.map((sz: any) => ({
          id: sz.sizeid.toString(),
          name: sz.sizename || 'Standard Size',
          price: { amount: finalPrice, currency: this.defaultCurrency }
        }));
      } else if (colors.length > 0) {
        variants = colors.map((col: any) => ({
          id: col.colorid.toString(),
          name: col.colorname || 'Standard Color',
          price: { amount: finalPrice, currency: this.defaultCurrency }
        }));
      }
    }

    return {
      id: productId.toString(),
      name: row.title || 'Untitled Product',
      description: row.description || 'Premium product from Razorpay AI Commerce store catalog.',
      price: {
        amount: finalPrice,
        currency: this.defaultCurrency
      },
      category: row.category_name || row.maincategory || 'Apparel',
      inStock: (row.stock === null || row.stock === undefined) ? true : row.stock > 0,
      imageUrl: row.imglink || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg',
      variants: variants.length > 0 ? variants : undefined
    };
  }
}
