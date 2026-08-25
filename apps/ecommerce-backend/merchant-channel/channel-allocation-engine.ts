import { client } from '../data/DB';
import { OmnichannelCatalogPlan, ProductChannelFit, ChannelSuitabilityScore, SalesChannel } from './channel-types';

export class ChannelAllocationEngine {
  /**
   * Evaluates product catalog fit across direct store, search, social, and marketplace channels.
   */
  async evaluateChannelAllocations(merchantId: string = 'default_merchant'): Promise<OmnichannelCatalogPlan> {
    const prodRes = await client.query(`
      SELECT 
        p.productid,
        p.title,
        p.price,
        p.discount,
        p.stock,
        c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.categoryid = c.categoryid
      ORDER BY p.stock DESC
      LIMIT 25;
    `);

    const channelSummary: Record<SalesChannel, { skuCount: number; status: 'ACTIVE' | 'NOT_CONFIGURED' }> = {
      DIRECT_STORE: { skuCount: 0, status: 'ACTIVE' },
      GOOGLE_SHOPPING: { skuCount: 0, status: 'NOT_CONFIGURED' },
      META_COMMERCE: { skuCount: 0, status: 'NOT_CONFIGURED' },
      MARKETPLACE: { skuCount: 0, status: 'NOT_CONFIGURED' },
      SOCIAL_COMMERCE: { skuCount: 0, status: 'NOT_CONFIGURED' },
      EMAIL_CAMPAIGNS: { skuCount: 0, status: 'ACTIVE' }
    };

    const fits: ProductChannelFit[] = [];

    for (const p of prodRes.rows) {
      const price = parseFloat(p.discount || p.price) || 1000;
      const cat = (p.category_name || '').toLowerCase();
      const title = (p.title || '').toLowerCase();

      const channels: ChannelSuitabilityScore[] = [];

      // 1. Direct Store Fit (Premium / Core Catalog)
      channels.push({
        channel: 'DIRECT_STORE',
        channelName: 'Direct Brand Storefront',
        suitabilityScore: 95,
        isConfigured: true,
        recommendedRole: 'Primary storefront anchor',
        rationale: 'Retains full margin and direct customer relationship data.'
      });

      // 2. Google Shopping Fit (High search intent, formalwear, essentials)
      const isSearchHigh = cat.includes('shirt') || cat.includes('formal') || cat.includes('trouser') || price > 2000;
      channels.push({
        channel: 'GOOGLE_SHOPPING',
        channelName: 'Google Shopping',
        suitabilityScore: isSearchHigh ? 85 : 55,
        isConfigured: false,
        recommendedRole: isSearchHigh ? 'High-intent search capture' : 'Secondary catalog visibility',
        rationale: isSearchHigh ? 'High consumer search volume for category specifications.' : 'Standard search demand.'
      });

      // 3. Meta Commerce Fit (Visual footwear, jackets, trendy apparel)
      const isVisual = cat.includes('shoe') || cat.includes('footwear') || title.includes('jacket') || title.includes('sneaker');
      channels.push({
        channel: 'META_COMMERCE',
        channelName: 'Meta & Instagram Shopping',
        suitabilityScore: isVisual ? 90 : 50,
        isConfigured: false,
        recommendedRole: isVisual ? 'Visual lifestyle conversion' : 'Broad awareness',
        rationale: isVisual ? 'High visual appeal and strong social discovery potential.' : 'Low impulse visual resonance.'
      });

      // 4. Marketplace Fit (Discounted / competitive mass volume)
      const isDiscounted = p.discount !== null && parseFloat(p.discount) < parseFloat(p.price);
      channels.push({
        channel: 'MARKETPLACE',
        channelName: 'Multi-Brand Marketplaces (Amazon / Flipkart)',
        suitabilityScore: isDiscounted ? 80 : 45,
        isConfigured: false,
        recommendedRole: isDiscounted ? 'Liquidation & volume clearance' : 'Full price brand protection',
        rationale: isDiscounted ? 'Price competitiveness aligns with marketplace deal discovery.' : 'Avoid marketplace margin erosion for full-price items.'
      });

      // Determine primary channel
      channels.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
      const primary = channels[0]?.channel || 'DIRECT_STORE';
      channelSummary[primary].skuCount += 1;

      fits.push({
        productId: p.productid,
        productTitle: p.title,
        price,
        category: p.category_name || 'General',
        primaryChannel: primary,
        channelBreakdown: channels,
        recommendationType: 'HEURISTIC RECOMMENDATION'
      });
    }

    return {
      totalCatalogSkus: prodRes.rows.length,
      channelAllocations: fits,
      channelSummary,
      evaluatedAt: new Date().toISOString()
    };
  }
}

export const channelAllocationEngine = new ChannelAllocationEngine();
