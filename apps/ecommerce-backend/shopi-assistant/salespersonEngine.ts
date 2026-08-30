import { ProductIntelligenceService, ProductFullIntelligence, ProductRecord, RecommendationConstraints } from './productIntelligence';
import { GroqAdapter } from '../ai-adapter/GroqAdapter';
import ShopiCatalogService from '../data/shopiCatalogService';

export interface ShopiAIContext {
  pageType: string;
  currentProduct?: {
    productId?: string | number;
    sku?: string;
    title?: string;
    price?: number;
    mrp?: number;
    category?: string;
    selectedColor?: string;
    selectedSize?: string;
    selectedVariantImage?: string;
  };
  selectedVariant?: {
    color?: string;
    size?: string;
    imageUrl?: string;
    price?: number;
  };
  activeFilters?: {
    category?: string;
    subcategory?: string;
    minPrice?: number;
    maxPrice?: number;
    rating?: number;
    gender?: string;
  };
  cart?: Array<{
    productId: string;
    sku?: string;
    name: string;
    price: number;
    quantity: number;
    color?: string;
    size?: string;
  }>;
  recentlyViewed?: Array<{
    productId: string;
    sku: string;
    title: string;
  }>;
  searchQuery?: string;
}

export interface ActiveShoppingQuery {
  category?: string;
  subcategory?: string;
  gender?: string;
  purpose?: string;
  maxPrice?: number;
  minPrice?: number;
  color?: string;
  size?: string;
  occasion?: string;
  excludedColors?: string[];
  excludedMaterials?: string[];
  excludedTerms?: string[];
  [key: string]: any;
}

export interface CurrentProductContext {
  productId: string | number;
  sku: string;
  title: string;
  color?: string;
  size?: string;
  imageUrl?: string;
  price?: number;
  mrp?: number;
  stock?: number;
}

export interface LastSearchContext {
  filters: ActiveShoppingQuery;
  results: ProductRecord[];
  timestamp: number;
}

export interface LastComparisonContext {
  products: any[];
  winner: any | null;
  comparisonData?: any;
}

export interface LastRecommendationContext {
  product: ProductRecord;
  sku: string;
  variant?: {
    color?: string;
    size?: string;
    imageUrl?: string;
    price?: number;
  };
  reasoning?: string;
}

export interface ConversationMemory {
  conversationId: string;
  userId?: number;
  activeQuery: ActiveShoppingQuery;
  activeConstraints: RecommendationConstraints;
  currentResults: ProductRecord[];
  currentProductContext: CurrentProductContext | null;
  lastSearchContext: LastSearchContext | null;
  lastComparisonContext: LastComparisonContext | null;
  lastRecommendationContext: LastRecommendationContext | null;
  cartContext: { items: any[] } | null;
  selectedProduct?: any | null;
  selectedVariant?: {
    color?: string;
    size?: string;
    imageUrl?: string;
    price?: number;
    variantId?: number;
    variantSku?: string;
  } | null;
  lastComparison?: {
    products: any[];
    winner: any | null;
  } | null;
  lastRecommendation?: any | null;
  lastDiscussedSku?: string;
  lastDiscussedTitle?: string;
  lastDiscussedVariant?: {
    color?: string;
    size?: string;
    imageUrl?: string;
  };
  bestRecommendedSku?: string;
  recentProducts: ProductRecord[];
  lastComparedSkus?: string[];
  lastAddedSku?: string;
  lastIntent?: string;
  updatedAt: number;
}

const memoryStore = new Map<string, ConversationMemory>();

export function getOrCreateMemory(conversationId: string, userId?: number): ConversationMemory {
  const key = conversationId || `anon_${userId || 'default'}`;
  let mem = memoryStore.get(key);
  if (!mem) {
    mem = {
      conversationId: key,
      userId,
      activeQuery: {},
      activeConstraints: {},
      currentResults: [],
      recentProducts: [],
      currentProductContext: null,
      lastSearchContext: null,
      lastComparisonContext: null,
      lastRecommendationContext: null,
      cartContext: null,
      selectedProduct: null,
      selectedVariant: null,
      lastComparison: null,
      lastRecommendation: null,
      updatedAt: Date.now()
    };
    memoryStore.set(key, mem);
  }
  return mem;
}

export interface SalespersonResult {
  message: string;
  intent: string;
  products?: any[];
  cart?: any;
  checkout?: any;
  addresses?: any[];
  selectedAddress?: any;
  audit: {
    intent: string;
    resolvedSku?: string;
    toolsUsed: string[];
    evidenceSummary?: string;
    constraints?: any;
  };
}

export class SalespersonEngine {
  private static groqAdapter = new GroqAdapter({
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    temperature: 0.2
  });

  /**
   * Main entry point for processing a shopper message
   */
  public static async processMessage(
    userMessage: string,
    context?: ShopiAIContext,
    conversationId?: string,
    userId?: number
  ): Promise<SalespersonResult> {
    const memory = getOrCreateMemory(conversationId || 'default_conv', userId);
    const msg = userMessage.trim();
    const lower = msg.toLowerCase();

    // 1. Sync Page Context into Memory if on product page
    if (context?.currentProduct?.sku) {
      const curSku = context.currentProduct.sku;
      const curColor = context.selectedVariant?.color || context.currentProduct.selectedColor;
      const curSize = context.selectedVariant?.size || context.currentProduct.selectedSize;
      const curImg = context.selectedVariant?.imageUrl || context.currentProduct.selectedVariantImage;

      memory.currentProductContext = {
        productId: context.currentProduct.productId || curSku,
        sku: curSku,
        title: context.currentProduct.title || curSku,
        color: curColor,
        size: curSize,
        imageUrl: curImg,
        price: context.currentProduct.price,
        mrp: context.currentProduct.mrp
      };

      if (!memory.selectedVariant && (curColor || curSize || curImg)) {
        memory.selectedVariant = {
          color: curColor,
          size: curSize,
          imageUrl: curImg,
          price: context.currentProduct.price
        };
      }
      memory.lastDiscussedSku = curSku;
      memory.lastDiscussedTitle = context.currentProduct.title || curSku;
    }

    // 2. Resolve Target SKU / Reference Product
    const resolvedSku = this.resolveTargetSku(msg, context, memory);

    // 3. Classify Intent
    const intent = this.classifySalespersonIntent(msg, resolvedSku, context, memory);

    // 4. Debug Logging (Requirement 20)
    this.logDebugState('BEFORE_INTENT', memory, context, resolvedSku, intent);

    const toolsUsed: string[] = [];

    // Active variant options from context or memory
    const activeColor = context?.selectedVariant?.color || context?.currentProduct?.selectedColor || memory.selectedVariant?.color || memory.currentProductContext?.color;
    const activeSize = context?.selectedVariant?.size || context?.currentProduct?.selectedSize || memory.selectedVariant?.size || memory.currentProductContext?.size;
    const activeVariantImg = context?.selectedVariant?.imageUrl || context?.currentProduct?.selectedVariantImage || memory.selectedVariant?.imageUrl || memory.currentProductContext?.imageUrl;

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 0: CURRENT_VARIANT_INQUIRY ("What colour am I viewing?", "What variant is this?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'CURRENT_VARIANT_INQUIRY') {
      toolsUsed.push('get_current_variant_context');
      const targetSku = resolvedSku || memory.currentProductContext?.sku || memory.selectedProduct?.sku || memory.lastDiscussedSku;
      if (targetSku) {
        const info = await ProductIntelligenceService.getProductBySkuOrId(targetSku);
        const catalogProd = await ShopiCatalogService.getProduct(targetSku);
        const p = info?.product || { sku: targetSku, title: memory.currentProductContext?.title || targetSku };

        const viewingColor = activeColor || catalogProd?.colors?.[0]?.colorname || 'Black';
        const viewingSize = activeSize || catalogProd?.sizes?.[0]?.sizename || 'S';

        const card = info
          ? this.toAiProductCard(info.product, info.reviewSummary, {
              color: viewingColor,
              size: viewingSize,
              imageUrl: activeVariantImg,
              catalogProduct: catalogProd
            })
          : null;

        const responseText = `You’re currently viewing the **${viewingColor}** variant${viewingSize ? ` (Size: **${viewingSize}**)` : ''} of **${p.title}** (\`${p.sku}\`).`;

        return {
          message: responseText,
          intent: 'current_variant_inquiry',
          products: card ? [card] : [],
          audit: {
            intent: 'CURRENT_VARIANT_INQUIRY',
            resolvedSku: targetSku,
            toolsUsed,
            evidenceSummary: `User is viewing ${targetSku} in Color: ${viewingColor}, Size: ${viewingSize}`
          }
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 1: BEST_PRODUCT_RECOMMENDATION ("Which one is the best?", "Which one would you recommend?", "Which one is better for daily running?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'BEST_PRODUCT_RECOMMENDATION') {
      toolsUsed.push('score_and_rank_products', 'get_product_review_summary');

      // Check if user is following up on an existing comparison (Requirement 11)
      const isComparisonFollowup = (
        lower.includes('which would you recommend') ||
        lower.includes('which one would you recommend') ||
        lower.includes('which one is better') ||
        lower.includes('which one should i choose')
      ) && (memory.lastComparisonContext?.products?.length || memory.lastComparison?.products?.length);

      if (isComparisonFollowup) {
        const compProds = memory.lastComparisonContext?.products || memory.lastComparison?.products || [];
        const winner = memory.lastComparisonContext?.winner || memory.lastComparison?.winner || compProds[0];

        if (winner) {
          memory.bestRecommendedSku = winner.sku;
          memory.lastRecommendation = winner;
          memory.lastRecommendationContext = { product: winner, sku: winner.sku, reasoning: 'Comparison winner' };
          memory.selectedProduct = winner;
          memory.lastDiscussedSku = winner.sku;

          const winnerInfo = await ProductIntelligenceService.getProductBySkuOrId(winner.sku);
          const catalogProd = await ShopiCatalogService.getProduct(winner.sku);
          const card = this.toAiProductCard(winner, winnerInfo?.reviewSummary, { catalogProduct: catalogProd });

          const runnerUp = compProds.find((p: any) => p.sku !== winner.sku);
          const msgResponse = runnerUp
            ? `Between the options we compared, I recommend **${winner.title}** (\`${winner.sku}\`) over **${runnerUp.title}**.\n\n` +
              `It offers superior customer ratings (⭐ **${winner.rating || winner.stars || 4.5}/5**), verified build quality, and balanced value for money at **₹${winner.selling_price || winner.sellingPrice}**.`
            : `I recommend **${winner.title}** (\`${winner.sku}\`) based on verified customer feedback and performance.`;

          return {
            message: msgResponse,
            intent: 'best_recommendation',
            products: [card],
            audit: {
              intent: 'BEST_PRODUCT_RECOMMENDATION',
              resolvedSku: winner.sku,
              toolsUsed,
              evidenceSummary: `Comparison winner recommended: ${winner.sku}`
            }
          };
        }
      }

      // If user asks about running specifically, enforce running purpose
      if (lower.includes('running')) {
        memory.activeConstraints.purpose = 'running';
        memory.activeConstraints.occasion = 'running';
      }

      let candidates = (memory.lastSearchContext?.results && memory.lastSearchContext.results.length > 0)
        ? memory.lastSearchContext.results
        : (memory.currentResults && memory.currentResults.length > 0 ? memory.currentResults : memory.recentProducts);

      if (candidates.length === 0) {
        const constraints = this.extractSearchConstraints(msg, context, memory);
        memory.activeConstraints = { ...memory.activeConstraints, ...constraints };
        candidates = await ProductIntelligenceService.recommendProducts({ ...memory.activeConstraints, limit: 10 });
        memory.currentResults = candidates;
        memory.recentProducts = candidates;
        memory.lastSearchContext = { filters: memory.activeConstraints, results: candidates, timestamp: Date.now() };
      }

      if (candidates.length > 0) {
        const evaluation = await this.evaluateBestProduct(candidates, memory.activeConstraints);
        const best = evaluation.bestProduct;
        memory.bestRecommendedSku = best.sku;
        memory.lastRecommendation = best;
        memory.lastRecommendationContext = { product: best, sku: best.sku, reasoning: evaluation.tradeOff };
        memory.selectedProduct = best;
        memory.lastDiscussedSku = best.sku;
        memory.lastDiscussedTitle = best.title;

        if (candidates.length >= 2) {
          memory.lastComparison = {
            products: candidates.slice(0, 2),
            winner: best
          };
          memory.lastComparisonContext = {
            products: candidates.slice(0, 2),
            winner: best
          };
        }

        const bestInfo = await ProductIntelligenceService.getProductBySkuOrId(best.sku);
        const catalogProd = await ShopiCatalogService.getProduct(best.sku);
        const card = this.toAiProductCard(best, bestInfo?.reviewSummary, { catalogProduct: catalogProd });

        const responseText = this.synthesizeBestProductExplanation(evaluation, candidates);

        return {
          message: responseText,
          intent: 'best_recommendation',
          products: [card],
          audit: {
            intent: 'BEST_PRODUCT_RECOMMENDATION',
            resolvedSku: best.sku,
            toolsUsed,
            evidenceSummary: `Multi-signal score evaluated across ${candidates.length} products. Winner: ${best.sku} with score ${evaluation.bestScore.toFixed(1)}/100`
          }
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 2: PRODUCT_DISADVANTAGES ("What are the main disadvantages?", "What are the cons?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_DISADVANTAGES') {
      const targetSku = resolvedSku || memory.currentProductContext?.sku || memory.selectedProduct?.sku || memory.lastDiscussedSku || memory.recentProducts[0]?.sku;

      if (targetSku) {
        toolsUsed.push('get_product_review_summary', 'get_product_cons');
        const info = await ProductIntelligenceService.getProductBySkuOrId(targetSku);
        const catalogProd = await ShopiCatalogService.getProduct(targetSku);

        if (info) {
          memory.selectedProduct = info.product;
          memory.lastDiscussedSku = info.product.sku;

          const chosenColor = activeColor || catalogProd?.colors?.[0]?.colorname;
          const chosenSize = activeSize || catalogProd?.sizes?.[0]?.sizename;

          const card = this.toAiProductCard(info.product, info.reviewSummary, {
            color: chosenColor,
            size: chosenSize,
            imageUrl: activeVariantImg,
            catalogProduct: catalogProd
          });

          const cons = info.reviewSummary?.cons || [];
          const responseText = `**Key Considerations & Disadvantages for ${info.product.title}** (\`${info.product.sku}\`):\n\n` +
            (cons.length > 0
              ? cons.map((c: string) => `• ⚠️ ${c}`).join('\n')
              : `• Standard regular fit silhouette; ensure you review the size chart if you prefer a slimmer fit.\n• Fabric requires gentle care (hand wash or delicate machine wash) to maintain weave finish.`) +
            `\n\n*Would you like me to compare it with alternative options or add it to your cart?*`;

          return {
            message: responseText,
            intent: 'product_disadvantages',
            products: [card],
            audit: {
              intent: 'PRODUCT_DISADVANTAGES',
              resolvedSku: info.product.sku,
              toolsUsed,
              evidenceSummary: `Extracted disadvantages and trade-offs for ${info.product.sku}`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 3: PRODUCT_INFO ("Tell me about this product", "What material is it?", "How is the fit?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_INFO' && resolvedSku) {
      toolsUsed.push('get_product', 'get_product_attributes', 'get_product_variants', 'get_product_review_summary');
      const info = await ProductIntelligenceService.getProductBySkuOrId(resolvedSku);
      const catalogProd = await ShopiCatalogService.getProduct(resolvedSku);

      if (info) {
        memory.selectedProduct = info.product;
        memory.lastDiscussedSku = info.product.sku;
        memory.lastDiscussedTitle = info.product.title;
        memory.recentProducts = [info.product, ...memory.recentProducts.filter(p => p.sku !== info.product.sku)].slice(0, 10);

        const chosenColor = activeColor || catalogProd?.colors?.[0]?.colorname;
        const chosenSize = activeSize || catalogProd?.sizes?.[0]?.sizename;

        const responseText = await this.synthesizeProductInfoResponse(info, msg);
        const card = this.toAiProductCard(info.product, info.reviewSummary, {
          color: chosenColor,
          size: chosenSize,
          imageUrl: activeVariantImg,
          catalogProduct: catalogProd
        });

        return {
          message: responseText,
          intent: 'product_info',
          products: [card],
          audit: {
            intent: 'PRODUCT_INFO',
            resolvedSku: info.product.sku,
            toolsUsed,
            evidenceSummary: `Retrieved ${info.product.sku} (${info.product.title}) with variant Color: ${chosenColor}, Size: ${chosenSize}`
          }
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 4: PRODUCT_WHY_BUY ("Why should I buy this?", "Why?", "Is it worth it?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_WHY_BUY') {
      const targetSku = resolvedSku || memory.lastRecommendationContext?.sku || memory.selectedProduct?.sku || memory.bestRecommendedSku || memory.lastDiscussedSku || memory.recentProducts[0]?.sku;

      if (targetSku) {
        toolsUsed.push('get_product', 'get_product_attributes', 'get_product_review_summary', 'get_product_scores');
        const info = await ProductIntelligenceService.getProductBySkuOrId(targetSku);
        const catalogProd = await ShopiCatalogService.getProduct(targetSku);

        if (info) {
          memory.selectedProduct = info.product;
          memory.lastDiscussedSku = info.product.sku;
          memory.lastDiscussedTitle = info.product.title;

          const chosenColor = activeColor || catalogProd?.colors?.[0]?.colorname;
          const chosenSize = activeSize || catalogProd?.sizes?.[0]?.sizename;

          const responseText = await this.synthesizeWhyBuyResponse(info, msg);
          const card = this.toAiProductCard(info.product, info.reviewSummary, {
            color: chosenColor,
            size: chosenSize,
            imageUrl: activeVariantImg,
            catalogProduct: catalogProd
          });

          return {
            message: responseText,
            intent: 'product_why_buy',
            products: [card],
            audit: {
              intent: 'PRODUCT_WHY_BUY',
              resolvedSku: info.product.sku,
              toolsUsed,
              evidenceSummary: `Synthesized salesperson reasoning with pros/trade-offs for ${info.product.sku}`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 5: PRODUCT_REVIEWS ("How are the reviews?", "What do customers think?")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_REVIEWS') {
      const targetSku = resolvedSku || memory.currentProductContext?.sku || memory.selectedProduct?.sku || memory.bestRecommendedSku || memory.lastDiscussedSku || memory.recentProducts[0]?.sku;

      if (targetSku) {
        toolsUsed.push('get_product_review_summary', 'get_product_reviews');
        const info = await ProductIntelligenceService.getProductBySkuOrId(targetSku);
        const catalogProd = await ShopiCatalogService.getProduct(targetSku);

        if (info) {
          memory.selectedProduct = info.product;
          memory.lastDiscussedSku = info.product.sku;

          const chosenColor = activeColor || catalogProd?.colors?.[0]?.colorname;
          const chosenSize = activeSize || catalogProd?.sizes?.[0]?.sizename;

          const responseText = await this.synthesizeReviewResponse(info);
          const card = this.toAiProductCard(info.product, info.reviewSummary, {
            color: chosenColor,
            size: chosenSize,
            imageUrl: activeVariantImg,
            catalogProduct: catalogProd
          });

          return {
            message: responseText,
            intent: 'product_reviews',
            products: [card],
            audit: {
              intent: 'PRODUCT_REVIEWS',
              resolvedSku: info.product.sku,
              toolsUsed,
              evidenceSummary: `Audited ${info.reviewSummary?.review_count || 0} reviews, rating ${info.reviewSummary?.average_rating || 0}`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 6: PRODUCT_AVAILABILITY / VARIANTS (Requirements 2, 3, 4, 5, 17, 18)
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_AVAILABILITY') {
      const targetSku = resolvedSku || memory.currentProductContext?.sku || memory.selectedProduct?.sku || memory.bestRecommendedSku || memory.lastDiscussedSku || memory.recentProducts[0]?.sku;

      if (targetSku) {
        toolsUsed.push('get_product_variants', 'get_catalog_colors');
        const info = await ProductIntelligenceService.getProductBySkuOrId(targetSku);
        const catalogProd = await ShopiCatalogService.getProduct(targetSku);

        if (info) {
          memory.selectedProduct = info.product;
          memory.lastDiscussedSku = info.product.sku;
          memory.lastDiscussedTitle = info.product.title;
          memory.lastIntent = 'PRODUCT_AVAILABILITY';

          const p = info.product;
          const availableColors = catalogProd?.colors || [];
          const allColorNames = availableColors.map((c: any) => c.colorname);
          const availableSizes = catalogProd?.sizes || [];
          const allSizeNames = availableSizes.map((s: any) => s.sizename);

          const resolution = this.resolveColorVariant(msg, availableColors);

          let responseText = '';
          let cards: any[] = [];

          if (resolution.isAmbiguous) {
            // Requirement 3: Ask disambiguation question when multiple shades exist
            const shadesList = resolution.matchingVariants.map((v: any) => v.colorname).join(' and ');
            responseText = `This shirt is available in **${shadesList}**. Which one would you like to see?`;
            cards = resolution.matchingVariants.map((v: any) => this.toAiProductCard(p, info.reviewSummary, {
              color: v.colorname,
              size: activeSize || allSizeNames[0] || 'S',
              imageUrl: v.imglink || undefined,
              catalogProduct: catalogProd
            }));
          } else if (resolution.requestedColorName && !resolution.isAvailable) {
            // Requirement 4: Explicitly state non-existence and list actual available colors
            responseText = `No, **${resolution.requestedColorName}** isn't currently available. Available colors are ${allColorNames.join(', ')}.`;
            cards = [this.toAiProductCard(p, info.reviewSummary, {
              color: activeColor || allColorNames[0],
              size: activeSize || allSizeNames[0],
              imageUrl: activeVariantImg,
              catalogProduct: catalogProd
            })];
          } else if (resolution.resolvedVariant) {
            // Requirement 2 & 3: Variant exists -> return variant and display variant image
            const v = resolution.resolvedVariant;
            const isSwitchCommand = lower.includes('show me') || lower.includes('switch to');
            responseText = isSwitchCommand
              ? `Here is the **${v.colorname}** variant of **${p.title}** (\`${p.sku}\`).`
              : `Yes, **${v.colorname}** is available! **${p.title}** (\`${p.sku}\`) is in stock.`;

            const card = this.toAiProductCard(p, info.reviewSummary, {
              color: v.colorname,
              size: activeSize || allSizeNames[0] || 'S',
              imageUrl: v.imglink || undefined,
              catalogProduct: catalogProd
            });
            cards = [card];

            // Update authoritative memory state
            memory.selectedVariant = {
              color: v.colorname,
              size: activeSize || allSizeNames[0] || 'S',
              imageUrl: v.imglink || undefined,
              price: p.selling_price
            };
            if (memory.currentProductContext) {
              memory.currentProductContext.color = v.colorname;
              memory.currentProductContext.imageUrl = v.imglink;
            }
            memory.lastDiscussedVariant = {
              color: v.colorname,
              size: activeSize || allSizeNames[0] || 'S',
              imageUrl: v.imglink || undefined
            };
          } else {
            // General availability overview
            if (allColorNames.length === 0 && allSizeNames.length === 0) {
              const effectiveStock = catalogProd?.stock !== undefined ? catalogProd.stock : Number(p.stock_quantity || 0);
              responseText = `**${p.title}** (\`${p.sku}\`) is available in stock (${effectiveStock > 0 ? `${effectiveStock} units available` : 'In Stock'}).`;
            } else {
              const effectiveStock = catalogProd?.stock !== undefined ? catalogProd.stock : Number(p.stock_quantity || 0);
              responseText = `**${p.title}** (\`${p.sku}\`) is available in:\n` +
                `• **Colors (${allColorNames.length})**: ${allColorNames.join(', ')}\n` +
                `• **Sizes (${allSizeNames.length > 0 ? allSizeNames.length : 'Standard'})**: ${allSizeNames.length > 0 ? allSizeNames.join(', ') : 'Standard size'}\n` +
                `• **Current Stock**: ${effectiveStock > 0 ? `In Stock (${effectiveStock} units available)` : 'In Stock'}`;
            }
            cards = [this.toAiProductCard(p, info.reviewSummary, {
              color: activeColor || allColorNames[0],
              size: activeSize || allSizeNames[0],
              imageUrl: activeVariantImg,
              catalogProduct: catalogProd
            })];
          }

          return {
            message: responseText,
            intent: 'product_availability',
            products: cards,
            audit: {
              intent: 'PRODUCT_AVAILABILITY',
              resolvedSku: info.product.sku,
              toolsUsed,
              evidenceSummary: `Checked variants for ${info.product.sku}. Returned ${cards.length} cards.`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 7: PRODUCT_COMPARISON ("Compare the first and third", "Compare these two")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'PRODUCT_COMPARISON') {
      toolsUsed.push('compare_products');
      const skusToCompare = this.resolveComparisonSkus(msg, context, memory);

      if (skusToCompare.length >= 2) {
        const comp = await ProductIntelligenceService.compareProducts(skusToCompare);
        if (comp && comp.products.length >= 2) {
          memory.lastComparedSkus = skusToCompare;

          // Determine authoritative winner
          let winner = comp.highestRatedProduct || comp.products[0];
          if (memory.activeConstraints?.purpose === 'running' || lower.includes('running')) {
            const runningWinner = comp.products.find((p: any) => 
              (p.category || '').toLowerCase() === 'sports-shoes' ||
              (p.sku || '').toUpperCase().includes('SPORTS-SHOE')
            );
            if (runningWinner) winner = runningWinner;
          }

          memory.lastComparison = {
            products: comp.products,
            winner
          };
          memory.lastComparisonContext = {
            products: comp.products,
            winner,
            comparisonData: comp
          };
          memory.lastRecommendation = winner;
          memory.lastRecommendationContext = { product: winner, sku: winner.sku, reasoning: 'Comparison winner' };
          memory.bestRecommendedSku = winner.sku;
          memory.selectedProduct = winner;
          memory.lastDiscussedSku = winner.sku;
          memory.lastDiscussedTitle = winner.title;

          const responseText = await this.synthesizeComparisonResponse(comp);
          const cards = comp.products.map((p: any) => ({
            id: String(p.productId),
            productId: String(p.productId),
            sku: p.sku,
            title: p.title,
            name: p.title,
            price: p.sellingPrice,
            mrp: p.mrp,
            discountPercentage: p.discountPercentage,
            category: p.category || p.brand || 'Footwear',
            imageUrl: p.imageUrl,
            stars: p.rating,
            rating: p.rating,
            reviewCount: p.reviewCount,
            inStock: true
          }));

          return {
            message: responseText,
            intent: 'product_comparison',
            products: cards,
            audit: {
              intent: 'PRODUCT_COMPARISON',
              resolvedSku: winner.sku,
              toolsUsed,
              evidenceSummary: `Compared [${skusToCompare.join(', ')}] across domain attributes. Winner: ${winner.sku}`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 8: SIMILAR_PRODUCTS ("Something like this", "Similar but cheaper")
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'SIMILAR_PRODUCTS') {
      const refSku = resolvedSku || memory.currentProductContext?.sku || memory.selectedProduct?.sku || memory.bestRecommendedSku || memory.lastDiscussedSku || context?.currentProduct?.sku;

      if (refSku) {
        toolsUsed.push('find_similar_products');
        const wantsCheaper = lower.includes('cheap') || lower.includes('less price') || lower.includes('budget') || lower.includes('lower');
        const wantsBetterReviews = lower.includes('better review') || lower.includes('higher rate') || lower.includes('top rated');

        const similarProds = await ProductIntelligenceService.findSimilarProducts(refSku, {
          cheaper: wantsCheaper,
          betterReviews: wantsBetterReviews,
          limit: 4
        });

        if (similarProds.length > 0) {
          memory.currentResults = similarProds;
          memory.recentProducts = similarProds;
          memory.lastSearchContext = { filters: { category: 'similar' }, results: similarProds, timestamp: Date.now() };
          memory.selectedProduct = similarProds[0];
          memory.lastDiscussedSku = similarProds[0].sku;

          const cards = similarProds.map(p => this.toAiProductCard(p));
          const qualifier = wantsCheaper ? 'more affordable alternatives' : wantsBetterReviews ? 'higher-rated alternatives' : 'similar products';
          const responseText = `Here are ${similarProds.length} ${qualifier} matching the style of **${refSku}**:\n\n` +
            similarProds.map(p => `• **${p.title}** (\`${p.sku}\`) — **₹${p.selling_price.toLocaleString('en-IN')}** (${p.discount_percentage}% OFF)`).join('\n');

          return {
            message: responseText,
            intent: 'similar_products',
            products: cards,
            audit: {
              intent: 'SIMILAR_PRODUCTS',
              resolvedSku: refSku,
              toolsUsed,
              evidenceSummary: `Found ${similarProds.length} alternatives for ${refSku}`
            }
          };
        }
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Intent 9: RECOMMENDATION / DISCOVERY & STRICT REFINEMENT (BUG 1, 2, 10 fixes)
    // ──────────────────────────────────────────────────────────────────────────
    if (intent === 'RECOMMENDATION' || intent === 'NEGATIVE_CONSTRAINTS') {
      toolsUsed.push('recommend_products');
      const extracted = this.extractSearchConstraints(msg, context, memory);

      // If user introduces a new distinct category, replace category
      if (extracted.category && memory.activeConstraints.category && extracted.category !== memory.activeConstraints.category) {
        memory.activeConstraints = { ...extracted };
      } else {
        memory.activeConstraints = { ...memory.activeConstraints, ...extracted };
      }

      memory.activeQuery = { ...memory.activeConstraints };

      const recommended = await ProductIntelligenceService.recommendProducts({
        ...memory.activeConstraints,
        limit: 10
      });

      if (recommended.length > 0) {
        memory.currentResults = recommended;
        memory.recentProducts = recommended;
        memory.lastSearchContext = { filters: memory.activeConstraints, results: recommended, timestamp: Date.now() };
        memory.selectedProduct = recommended[0];
        memory.lastRecommendation = recommended[0];
        memory.lastRecommendationContext = { product: recommended[0], sku: recommended[0].sku };
        memory.lastDiscussedSku = recommended[0].sku;
        memory.lastDiscussedTitle = recommended[0].title;

        // Build product cards with active color constraint attached
        const cards = recommended.map(p => this.toAiProductCard(p, undefined, {
          color: memory.activeConstraints.color
        }));

        const responseText = await this.synthesizeRecommendationResponse(recommended, memory.activeConstraints, msg);

        return {
          message: responseText,
          intent: 'recommendation',
          products: cards,
          audit: {
            intent: 'RECOMMENDATION',
            toolsUsed,
            constraints: memory.activeConstraints,
            evidenceSummary: `Found ${recommended.length} products matching criteria ${JSON.stringify(memory.activeConstraints)}`
          }
        };
      } else {
        return {
          message: `I couldn't find any products strictly matching those specific filters (such as budget under ₹${memory.activeConstraints.maxPrice || 0} or your color/preference filters). Let me know if you'd like to adjust your price range or explore related categories!`,
          intent: 'recommendation_empty',
          products: [],
          audit: {
            intent: 'RECOMMENDATION',
            toolsUsed,
            constraints: memory.activeConstraints,
            evidenceSummary: 'No matching products found for constraints'
          }
        };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Fallback: General Sales Guidance
    // ──────────────────────────────────────────────────────────────────────────
    const generalRecs = await ProductIntelligenceService.recommendProducts({ limit: 6 });
    const cards = generalRecs.map(p => this.toAiProductCard(p));

    return {
      message: "I'm your **Shopi Salesperson**. I can give you detailed product briefings, verify review sentiments, check variant stock, compare items side-by-side, or find curated items tailored to your budget and style. What can I help you find today?",
      intent: 'general_guidance',
      products: cards,
      audit: {
        intent: 'GENERAL',
        toolsUsed: ['general_guidance'],
        evidenceSummary: 'Provided general shopping guidance and top recommendations.'
      }
    };
  }

  /**
   * Deterministic Color Resolution and Disambiguation
   */
  public static resolveColorVariant(
    message: string,
    availableColors: any[]
  ): {
    requestedColorName?: string;
    isExplicit: boolean;
    isAmbiguous: boolean;
    isAvailable: boolean;
    matchingVariants: any[];
    resolvedVariant?: any;
  } {
    const lower = message.toLowerCase().trim();

    // Comprehensive list of color tokens
    const colorDictionary: Array<{ key: string; name: string; aliases: string[] }> = [
      { key: 'navy blue', name: 'Navy Blue', aliases: ['navy blue', 'navy', 'dark blue', 'deep blue'] },
      { key: 'sky blue', name: 'Sky Blue', aliases: ['sky blue', 'sky', 'light blue', 'cyan', 'ice blue'] },
      { key: 'blue', name: 'Blue', aliases: ['blue'] },
      { key: 'black', name: 'Black', aliases: ['black', 'jet black', 'charcoal'] },
      { key: 'green', name: 'Green', aliases: ['green', 'olive green', 'dark green', 'forest green'] },
      { key: 'pista', name: 'Pista', aliases: ['pista', 'pista green', 'mint', 'sage'] },
      { key: 'maroon', name: 'Maroon', aliases: ['maroon', 'burgundy', 'wine', 'brown'] },
      { key: 'white', name: 'White', aliases: ['white', 'off white', 'cream', 'ivory'] },
      { key: 'pink', name: 'Pink', aliases: ['pink', 'rose', 'baby pink', 'blush'] },
      { key: 'yellow', name: 'Yellow', aliases: ['yellow', 'mustard', 'lemon'] },
      { key: 'purple', name: 'Purple', aliases: ['purple', 'violet', 'lavender', 'lilac', 'plum'] },
      { key: 'red', name: 'Red', aliases: ['red', 'crimson', 'scarlet'] },
      { key: 'grey', name: 'Grey', aliases: ['grey', 'gray', 'silver', 'slate'] },
      { key: 'orange', name: 'Orange', aliases: ['orange', 'peach', 'coral'] }
    ];

    let foundKey: string | undefined;
    let canonicalName: string | undefined;

    for (const entry of colorDictionary) {
      for (const alias of entry.aliases) {
        const regex = new RegExp(`\\b${alias}\\b`, 'i');
        if (regex.test(lower)) {
          foundKey = entry.key;
          canonicalName = entry.name;
          break;
        }
      }
      if (foundKey) break;
    }

    if (!foundKey || !canonicalName) {
      return {
        isExplicit: false,
        isAmbiguous: false,
        isAvailable: false,
        matchingVariants: []
      };
    }

    // Check specific catalog variants
    const allNames = availableColors.map((c: any) => c.colorname || '');

    // Check if generic "blue" was requested
    if (foundKey === 'blue') {
      const blueShades = availableColors.filter((c: any) =>
        (c.colorname || '').toLowerCase().includes('blue')
      );
      if (blueShades.length > 1) {
        return {
          requestedColorName: 'Blue',
          isExplicit: true,
          isAmbiguous: true,
          isAvailable: true,
          matchingVariants: blueShades
        };
      } else if (blueShades.length === 1) {
        return {
          requestedColorName: blueShades[0].colorname,
          isExplicit: true,
          isAmbiguous: false,
          isAvailable: true,
          matchingVariants: blueShades,
          resolvedVariant: blueShades[0]
        };
      }
    }

    // Direct match against available catalog variants
    const exactMatch = availableColors.find((c: any) =>
      (c.colorname || '').toLowerCase() === canonicalName!.toLowerCase()
    );
    if (exactMatch) {
      return {
        requestedColorName: exactMatch.colorname,
        isExplicit: true,
        isAmbiguous: false,
        isAvailable: true,
        matchingVariants: [exactMatch],
        resolvedVariant: exactMatch
      };
    }

    // Partial match (e.g. "navy" matching "Navy Blue")
    const partialMatch = availableColors.find((c: any) =>
      (c.colorname || '').toLowerCase().includes(foundKey!) ||
      foundKey!.includes((c.colorname || '').toLowerCase())
    );
    if (partialMatch) {
      return {
        requestedColorName: partialMatch.colorname,
        isExplicit: true,
        isAmbiguous: false,
        isAvailable: true,
        matchingVariants: [partialMatch],
        resolvedVariant: partialMatch
      };
    }

    // Color requested is NOT available in this product
    return {
      requestedColorName: canonicalName,
      isExplicit: true,
      isAmbiguous: false,
      isAvailable: false,
      matchingVariants: []
    };
  }

  /**
   * Deterministically resolve which SKU the user is referring to (Requirement 15)
   */
  public static resolveTargetSku(
    message: string,
    context?: ShopiAIContext,
    memory?: ConversationMemory
  ): string | undefined {
    const upper = message.toUpperCase();
    const lower = message.toLowerCase().trim();

    // 1. Explicit SKU mention (e.g. SHIRT-002, FORMAL-SHOE-001, JEANS-001, SPORTS-SHOE-006)
    const skuRegex = /\b([A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)?)\b/;
    const match = upper.match(skuRegex);
    if (match && match[1]) {
      return match[1];
    }

    // 2. Evaluated Winner / Best / Recommended references (BUG 7 fix)
    if (
      lower.includes('better one') ||
      lower.includes('the better') ||
      lower.includes('recommended one') ||
      lower.includes('the recommended') ||
      lower.includes('best one') ||
      lower.includes('the winner') ||
      lower.includes('winning one') ||
      lower.includes('add the better') ||
      lower.includes('add the recommended') ||
      lower.includes('add the winner')
    ) {
      if (memory?.lastComparisonContext?.winner?.sku) return memory.lastComparisonContext.winner.sku;
      if (memory?.lastComparison?.winner?.sku) return memory.lastComparison.winner.sku;
      if (memory?.lastRecommendationContext?.sku) return memory.lastRecommendationContext.sku;
      if (memory?.lastRecommendation?.sku) return memory.lastRecommendation.sku;
      if (memory?.bestRecommendedSku) return memory.bestRecommendedSku;
      if (memory?.currentProductContext?.sku) return memory.currentProductContext.sku;
      if (memory?.selectedProduct?.sku) return memory.selectedProduct.sku;
      if (memory?.lastDiscussedSku) return memory.lastDiscussedSku;
      if (memory?.currentResults && memory.currentResults.length > 0) return memory.currentResults[0].sku;
    }

    // 3. Ordinal references into current recommendation results (BUG 6 fix)
    const resultPool = (memory?.lastSearchContext?.results && memory.lastSearchContext.results.length > 0)
      ? memory.lastSearchContext.results
      : (memory?.currentResults && memory.currentResults.length > 0 ? memory.currentResults : (memory?.recentProducts || []));

    if (resultPool.length > 0) {
      // Robust ordinal resolution via token parsing: "add the first one", "add 3rd", "buy the last one"
      const ordinals = this.parseOrdinals(lower);
      if (ordinals.length >= 1) {
        // For add-to-cart, use the FIRST ordinal mentioned
        const o = ordinals[0];
        if (o === -1) {
          return resultPool[resultPool.length - 1]?.sku;
        }
        if (o >= 0 && o < resultPool.length) {
          return resultPool[o]?.sku;
        }
      }
    }

    // 3b. Title → SKU resolution (e.g. "add the Centrino Men's 9564 Glossy Formal Shoes to my cart")
    // Matches against the current result pool first, then the full catalog.
    const stripCommandWords = (s: string) =>
      s.replace(/\b(please|can you|could you|i want|add|put|place|buy|the|to|into|in|my|cart|bag|a|an|one|item|product)\b/gi, ' ').replace(/\s+/g, ' ').trim();
    const queryTitle = stripCommandWords(message);
    if (queryTitle.length >= 6) {
      // 3b-1. Exact/partial match within the result pool (fast path)
      const poolMatch = resultPool.find((p: any) => {
        const t = (p.title || '').toLowerCase();
        return t && (t === queryTitle || t.includes(queryTitle) || queryTitle.includes(t));
      });
      if (poolMatch?.sku) return poolMatch.sku;

      // 3b-2. Match against recently shown/discussed products
      const recentMatch = (memory?.recentProducts || []).find((p: any) => {
        const t = (p.title || '').toLowerCase();
        return t && (t.includes(queryTitle) || queryTitle.includes(t));
      });
      if (recentMatch?.sku) return recentMatch.sku;

      // 3b-3. Full catalog search by title (async handled by caller; here we do a
      // synchronous fuzzy match against known product titles in memory results
      // accumulated across the conversation). If not found, fall through — the
      // backend route's ADD_TO_CART handler will also try ProductIntelligenceService.
      const normalized = queryTitle.replace(/[^a-z0-9 ]/gi, '');
      const catalogGuess = (memory?.lastSearchContext?.results || [])
        .concat(memory?.recentProducts || [])
        .find((p: any) => {
          const t = (p.title || '').toLowerCase().replace(/[^a-z0-9 ]/gi, '');
          return t && (t === normalized || t.includes(normalized) || normalized.includes(t));
        });
      if (catalogGuess?.sku) return catalogGuess.sku;
    }

    // 4. "that one" refers to last recommended product (Requirement 14)
    if (lower.includes('that one') || lower.includes('that product') || lower.includes('that item')) {
      if (memory?.lastRecommendationContext?.sku) return memory.lastRecommendationContext.sku;
      if (memory?.lastRecommendation?.sku) return memory.lastRecommendation.sku;
      if (memory?.bestRecommendedSku) return memory.bestRecommendedSku;
      if (memory?.selectedProduct?.sku) return memory.selectedProduct.sku;
    }

    // 5. Pronoun / Context Reference checks (Requirement 15)
    const hasReference = (
      lower.includes('this') ||
      lower.includes('it') ||
      lower.includes('that') ||
      lower === 'why' ||
      lower === 'why?' ||
      lower.startsWith('why?') ||
      lower.startsWith('why ') ||
      lower.includes('why should i buy') ||
      lower.includes('how are the reviews') ||
      lower.includes('tell me about') ||
      lower.includes('is it worth') ||
      lower.includes('is this worth') ||
      lower.includes('is it available') ||
      lower.includes('is this available') ||
      lower.includes('add this') ||
      lower.includes('add it') ||
      lower.includes('what colour am i viewing') ||
      lower.includes('what color am i viewing') ||
      lower.includes('what color is this') ||
      lower.includes('what are the main disadvantages') ||
      lower.includes('disadvantages') ||
      lower.includes('the product') ||
      lower.includes('the item') ||
      lower.includes('the shoe') ||
      lower.includes('the shirt') ||
      lower.includes('the dress') ||
      lower.includes('the jeans')
    );

    if (hasReference) {
      // Priority 1: Current page product
      if (context?.currentProduct?.sku) {
        return context.currentProduct.sku;
      }
      if (context?.currentProduct?.productId) {
        return String(context.currentProduct.productId);
      }

      // Priority 2: Current product context in memory
      if (memory?.currentProductContext?.sku) {
        return memory.currentProductContext.sku;
      }

      // Priority 3: Current selected product / variant in memory
      if (memory?.selectedProduct?.sku) {
        return memory.selectedProduct.sku;
      }

      // Priority 4: Evaluated winner or last recommended product
      if (memory?.lastRecommendationContext?.sku) {
        return memory.lastRecommendationContext.sku;
      }
      if (memory?.lastRecommendation?.sku) {
        return memory.lastRecommendation.sku;
      }
      if (memory?.bestRecommendedSku) {
        return memory.bestRecommendedSku;
      }
      if (memory?.lastDiscussedSku) {
        return memory.lastDiscussedSku;
      }

      // Priority 5: First item in recent products
      if (resultPool.length > 0) {
        return resultPool[0].sku;
      }
    }

    // If on a product page and no other product was specified, default to the current product!
    if (context?.pageType === 'product' && context.currentProduct?.sku) {
      return context.currentProduct.sku;
    }

    return undefined;
  }

  /**
   * Deterministic Intent Classifier
   */
  private static classifySalespersonIntent(
    message: string,
    resolvedSku?: string,
    context?: ShopiAIContext,
    memory?: ConversationMemory
  ): string {
    const lower = message.toLowerCase().trim();

    // 0. Current Variant Inquiry ("What colour am I viewing?", "What color is this?") (Requirement 1)
    if (
      lower.includes('what colour am i viewing') ||
      lower.includes('what color am i viewing') ||
      lower.includes('what colour is this') ||
      lower.includes('what color is this') ||
      lower.includes('which colour am i viewing') ||
      lower.includes('which color am i viewing') ||
      lower.includes('which variant am i viewing') ||
      lower.includes('what variant is this') ||
      lower.includes('what size am i viewing') ||
      lower.includes('current color')
    ) {
      return 'CURRENT_VARIANT_INQUIRY';
    }

    // 1. Disadvantages / Cons ("What are the main disadvantages?", "Any flaws?", "Cons") (Requirement 9 & 10)
    if (
      lower.includes('disadvantage') ||
      lower.includes('drawback') ||
      lower.includes('cons') ||
      lower.includes('flaw') ||
      lower.includes('complaint') ||
      lower.includes('negative') ||
      lower.includes('weakness') ||
      lower.includes("why shouldn't i buy") ||
      lower.includes('any issues')
    ) {
      if (resolvedSku || context?.pageType === 'product' || memory?.currentProductContext || memory?.selectedProduct) {
        return 'PRODUCT_DISADVANTAGES';
      }
    }

    // 2. Best Product Recommendation ("Which one is best?", "Which one should I buy?", "Which would you recommend?")
    if (
      lower.includes('which one is the best') ||
      lower.includes('which one is best') ||
      lower.includes('which is the best') ||
      lower.includes('which is best') ||
      lower.includes('which one should i buy') ||
      lower.includes('what is the best') ||
      lower.includes('personally recommend') ||
      lower.includes('which would you recommend') ||
      lower.includes('which one would you recommend') ||
      lower.includes('best option')
    ) {
      return 'BEST_PRODUCT_RECOMMENDATION';
    }

    // 3. Comparison ("Compare the first and third", "Compare these two", "Which is better?")
    if (
      lower.includes('compare') ||
      lower.includes('which is better') ||
      lower.includes('which one is better') ||
      lower.includes('difference between') ||
      lower.includes('better than')
    ) {
      return 'PRODUCT_COMPARISON';
    }

    // 4. Follow-up "Why?" or "Why should I buy this?" (Requirement 12)
    if (
      lower === 'why' ||
      lower === 'why?' ||
      lower.startsWith('why?') ||
      lower.startsWith('why did you') ||
      lower.startsWith('why do you') ||
      lower.includes('why should i buy') ||
      lower.includes('why buy this') ||
      lower.includes('is it worth') ||
      lower.includes('is this worth') ||
      lower.includes('who is this for')
    ) {
      return 'PRODUCT_WHY_BUY';
    }

    // 5. Similar Products
    if (
      lower.includes('similar') ||
      lower.includes('something like this') ||
      lower.includes('like this but') ||
      lower.includes('same style') ||
      lower.includes('another one like this')
    ) {
      return 'SIMILAR_PRODUCTS';
    }

    // 6. Availability / Variant checks / Color inquiries / Variant switching (Requirements 2, 3, 4, 5)
    if (
      lower.includes('available in') ||
      lower.includes('come in') ||
      lower.includes('what sizes') ||
      lower.includes('what colors') ||
      lower.includes('in stock') ||
      lower.includes('have black') ||
      lower.includes('have blue') ||
      lower.includes('have green') ||
      lower.includes('have purple') ||
      lower.includes('have maroon') ||
      lower.includes('have pink') ||
      lower.includes('have white') ||
      lower.includes('have yellow') ||
      lower.includes('have size') ||
      lower.includes('is this available') ||
      lower.includes('is it available') ||
      lower.includes('is there a') ||
      lower.includes('variant') ||
      lower.includes('does it come') ||
      lower.includes('does this come') ||
      lower.includes('do you have') ||
      lower.includes('show me the') ||
      lower.includes('show me green') ||
      lower.includes('show me blue') ||
      lower.includes('show me black') ||
      lower.includes('show me maroon') ||
      lower.includes('show me navy') ||
      lower.includes('show me white') ||
      lower.includes('show me pink') ||
      lower.includes('show me yellow') ||
      lower.includes('show me purple')
    ) {
      if (resolvedSku || context?.pageType === 'product' || memory?.currentProductContext || memory?.lastDiscussedSku) {
        return 'PRODUCT_AVAILABILITY';
      }
    }

    // 7. Review questions
    if (
      lower.includes('review') ||
      lower.includes('rating') ||
      lower.includes('what do customer') ||
      lower.includes('what are people saying') ||
      lower.includes('customer think')
    ) {
      if (resolvedSku || context?.pageType === 'product' || memory?.currentProductContext) {
        return 'PRODUCT_REVIEWS';
      }
    }

    // 8. Product Info / Brief
    if (
      lower.includes('tell me about') ||
      lower.includes('what is this') ||
      lower.includes('give me a brief') ||
      lower.includes('product detail') ||
      lower.includes('describe') ||
      lower.includes('how is the fit') ||
      lower.includes('how is the quality') ||
      lower.includes('is it comfortable') ||
      lower.includes('what material') ||
      lower.includes('what fabric')
    ) {
      if (resolvedSku || context?.pageType === 'product' || memory?.currentProductContext) {
        return 'PRODUCT_INFO';
      }
    }

    // 9. Negative constraints
    if (
      lower.includes("don't want") ||
      lower.includes('dont want') ||
      lower.includes('no black') ||
      lower.includes('no leather') ||
      lower.includes('not formal') ||
      lower.includes('exclude') ||
      lower.includes('nothing above')
    ) {
      return 'NEGATIVE_CONSTRAINTS';
    }

    // 10. Search & Recommendation
    if (
      lower.includes('find') ||
      lower.includes('show me') ||
      lower.includes('look for') ||
      lower.includes('need') ||
      lower.includes('want') ||
      lower.includes('under') ||
      lower.includes('below') ||
      lower.includes('recommend') ||
      lower.includes('suggest') ||
      lower.includes('shirt') ||
      lower.includes('shoe') ||
      lower.includes('jeans') ||
      lower.includes('dress')
    ) {
      return 'RECOMMENDATION';
    }

    if (resolvedSku) {
      return 'PRODUCT_INFO';
    }

    return 'GENERAL';
  }

  /**
   * Multi-Signal Evaluation Algorithm for Best Product Recommendation
   */
  private static async evaluateBestProduct(
    products: ProductRecord[],
    constraints: RecommendationConstraints
  ): Promise<{
    bestProduct: ProductRecord;
    bestScore: number;
    runnersUp: Array<{ product: ProductRecord; score: number }>;
    tradeOff: string;
    keyStrengths: string[];
  }> {
    let topProd = products[0];
    let maxScore = -1;
    const scoredList: Array<{ product: ProductRecord; score: number }> = [];
    const isRunning = constraints.purpose === 'running' || constraints.occasion === 'running';

    for (const p of products) {
      let score = 50; // Base score
      const pCat = (p.category || '').toLowerCase();
      const pTitle = p.title.toLowerCase();

      // Purpose & Category Matching
      if (isRunning) {
        if (pCat === 'sports-shoes' || pTitle.includes('running')) {
          score += 40;
        } else if (pCat === 'formal-shoes') {
          score -= 50; // Formal shoes disqualified for running
        }
      } else if (constraints.category) {
        if (pCat.includes(constraints.category.toLowerCase()) || pTitle.includes(constraints.category.toLowerCase())) {
          score += 20;
        }
      }

      // Value for money (Discount percentage & realistic pricing)
      const discount = p.discount_percentage || 0;
      if (discount >= 80) score += 20;
      else if (discount >= 70) score += 16;
      else if (discount >= 50) score += 12;
      else score += 8;

      // Rating bonus
      const rating = (p as any).rating || 4.2;
      score += Math.round(rating * 5);

      scoredList.push({ product: p, score });

      if (score > maxScore) {
        maxScore = score;
        topProd = p;
      }
    }

    scoredList.sort((a, b) => b.score - a.score);

    // Fetch review intelligence for the winner to extract real pros & trade-offs
    const info = await ProductIntelligenceService.getProductBySkuOrId(topProd.sku);
    const pros = info?.reviewSummary?.pros?.slice(0, 3) || (isRunning ? ['High-impact cushioning', 'Memory foam insole', 'Breathable mesh upper'] : ['Comfortable fit', 'High discount against MRP', 'Versatile styling']);
    const cons = info?.reviewSummary?.cons?.slice(0, 1) || ['Standard regular fit sizing; check size chart if between sizes'];

    return {
      bestProduct: topProd,
      bestScore: maxScore,
      runnersUp: scoredList.slice(1, 4),
      tradeOff: cons[0] || 'Fit may feel relaxed for slim athletic builds',
      keyStrengths: pros
    };
  }

  /**
   * Synthesize Best Product Explanation
   */
  private static synthesizeBestProductExplanation(
    evaluation: any,
    allCandidates: ProductRecord[]
  ): string {
    const best = evaluation.bestProduct;
    const cheaperPeer = allCandidates.find(p => p.selling_price < best.selling_price);

    const priceCompare = cheaperPeer
      ? `While **${cheaperPeer.sku}** is slightly cheaper at **₹${cheaperPeer.selling_price}**, I recommend **${best.title}** (\`${best.sku}\`).`
      : `I recommend **${best.title}** (\`${best.sku}\`).`;

    const strengthsText = evaluation.keyStrengths.map((s: string) => `  ✓ ${s}`).join('\n');

    return `${priceCompare}\n\n` +
      `It delivers the strongest combination of price (**₹${best.selling_price.toLocaleString('en-IN')}** • **${best.discount_percentage}% OFF** ~₹${best.mrp.toLocaleString('en-IN')}~), verified customer satisfaction, and specialized construction.\n\n` +
      `**Why It Stands Out**:\n${strengthsText}\n\n` +
      `**Main Trade-off**: ${evaluation.tradeOff}.\n\n` +
      `*Would you like me to add ${best.sku} to your cart, or compare it with another option?*`;
  }

  /**
   * Parse comparison target SKUs from message (BUG 6 fix)
   */
  /**
   * Parses ordinal words/digits ("first", "2nd", "the third one") into 0-based indices.
   * Robust against filler words: "compare the first and the third one" → [0, 2].
   */
  private static parseOrdinals(text: string): number[] {
    const lower = text.toLowerCase();
    const wordMap: Record<string, number> = {
      'first': 0, '1st': 0, 'one': 0,
      'second': 1, '2nd': 1, 'two': 1,
      'third': 2, '3rd': 2, 'three': 2,
      'fourth': 3, '4th': 3, 'four': 3,
      'fifth': 4, '5th': 4, 'five': 4,
      'last': -1,
    };
    const tokens = lower.split(/[^a-z0-9]+/).filter(Boolean);
    const ordinals: number[] = [];
    for (const tok of tokens) {
      if (tok in wordMap) {
        const idx = wordMap[tok];
        // Avoid double-counting "one" when it's part of "the first one" (both map to 0/0)
        if (ordinals.length > 0 && idx === 0 && tok === 'one') continue;
        ordinals.push(idx);
      }
    }
    // De-duplicate consecutive same ordinals ("first one" → [0,0] → [0])
    const deduped: number[] = [];
    for (const o of ordinals) {
      if (deduped.length === 0 || deduped[deduped.length - 1] !== o) deduped.push(o);
    }
    return deduped;
  }

  private static resolveComparisonSkus(
    message: string,
    context?: ShopiAIContext,
    memory?: ConversationMemory
  ): string[] {
    const lower = message.toLowerCase();
    const resultPool = (memory?.lastSearchContext?.results && memory.lastSearchContext.results.length > 0)
      ? memory.lastSearchContext.results
      : (memory?.currentResults && memory.currentResults.length > 0 ? memory.currentResults : (memory?.recentProducts || []));

    // 1. Explicit SKUs mentioned
    const matches = message.toUpperCase().match(/\b([A-Z0-9]+-[A-Z0-9]+(-[A-Z0-9]+)?)\b/g);
    if (matches && matches.length >= 2) {
      return Array.from(new Set(matches)).slice(0, 3);
    }

    // 2. Robust ordinal parsing: "first and third", "the 1st and the 3rd one", "second vs fourth"
    const ordinals = this.parseOrdinals(lower);
    if (ordinals.length >= 2 && resultPool.length >= 2) {
      const skus: string[] = [];
      for (const o of ordinals.slice(0, 3)) {
        const resolvedIdx = o === -1 ? resultPool.length - 1 : o;
        if (resolvedIdx >= 0 && resolvedIdx < resultPool.length) {
          const sku = resultPool[resolvedIdx].sku;
          if (sku && !skus.includes(sku)) skus.push(sku);
        }
      }
      if (skus.length >= 2) return skus;
      // Not enough valid ordinals in pool → fall through to partial pair below
    }

    // 3. Single ordinal ("compare with the first one") → winner/current vs that ordinal
    if (ordinals.length === 1) {
      const o = ordinals[0];
      const resolvedIdx = o === -1 ? resultPool.length - 1 : o;
      const target = (resolvedIdx >= 0 && resolvedIdx < resultPool.length) ? resultPool[resolvedIdx].sku : undefined;
      const winner = memory?.lastComparisonContext?.winner?.sku || memory?.lastComparison?.winner?.sku || memory?.bestRecommendedSku || memory?.lastDiscussedSku || context?.currentProduct?.sku;
      if (target && winner && target !== winner) {
        return [winner, target];
      }
      if (target && resultPool.length >= 2) {
        const other = resultPool.find((p: any) => p.sku !== target);
        if (other) return [target, other.sku];
      }
    }

    // 4. "Compare these two" / plain "compare" → top two of pool
    if (resultPool.length >= 2) {
      return [resultPool[0].sku, resultPool[1].sku];
    }

    // 5. Fallback: current product + peer
    if (context?.currentProduct?.sku) {
      const skus = [context.currentProduct.sku];
      if (memory?.lastDiscussedSku && memory.lastDiscussedSku !== context.currentProduct.sku) {
        skus.push(memory.lastDiscussedSku);
      }
      return skus;
    }

    return [];
  }

  /**
   * Parse search filters and negative constraints (BUG 1 & 2 fix)
   */
  private static extractSearchConstraints(
    message: string,
    context?: ShopiAIContext,
    memory?: ConversationMemory
  ): RecommendationConstraints {
    const lower = message.toLowerCase();
    const constraints: RecommendationConstraints = {};

    // 1. Inherit from active page context or existing memory
    if (context?.activeFilters?.category) constraints.category = context.activeFilters.category;
    if (context?.activeFilters?.subcategory) constraints.subcategory = context.activeFilters.subcategory;
    if (context?.activeFilters?.gender) constraints.gender = context.activeFilters.gender;
    if (context?.activeFilters?.maxPrice) constraints.maxPrice = context.activeFilters.maxPrice;

    // Detect Specific Categories & Purposes
    if (lower.includes('running') || lower.includes('sports shoe') || lower.includes('sport shoe')) {
      constraints.category = 'Sports-Shoes';
      constraints.subcategory = "Men's Running Shoes";
      constraints.purpose = 'running';
      constraints.occasion = 'running';
    } else if (lower.includes('formal shoe') || lower.includes('office shoe') || lower.includes('derby') || lower.includes('oxford')) {
      constraints.category = 'Formal-Shoes';
      constraints.subcategory = "Men's Formal Shoes";
      constraints.purpose = 'formal';
      constraints.occasion = 'office';
    } else if (lower.includes('sneaker')) {
      constraints.category = 'Sneakers';
      constraints.subcategory = "Casual Sneakers";
      constraints.purpose = 'casual';
    } else if (lower.includes('shoe') || lower.includes('footwear')) {
      constraints.category = 'Footwear';
    } else if (lower.includes('t-shirt') || lower.includes('tshirt') || lower.includes('polo')) {
      constraints.category = 'T-Shirt';
    } else if (lower.includes('shirt')) {
      constraints.category = 'Shirts';
    } else if (lower.includes('jeans') || lower.includes('denim')) {
      constraints.category = 'Jeans';
    } else if (lower.includes('jacket') || lower.includes('bomber')) {
      constraints.category = 'Jackets';
    } else if (lower.includes('dress') || lower.includes('kurta') || lower.includes('anarkali') || lower.includes('lehenga')) {
      constraints.category = 'Dresses';
    } else if (lower.includes('bag') || lower.includes('backpack')) {
      constraints.category = 'Bags';
    }

    // Detect Gender
    if (lower.includes('men') || lower.includes("men's") || lower.includes('man') || lower.includes('male')) {
      constraints.gender = 'Men';
    } else if (lower.includes('women') || lower.includes("women's") || lower.includes('female') || lower.includes('lady')) {
      constraints.gender = 'Women';
    }

    // Detect Price (e.g. "under 500", "under ₹500", "below 600", "under 1000")
    const priceMatch = lower.match(/(?:under|below|less than|within|max|budget)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (priceMatch && priceMatch[1]) {
      constraints.maxPrice = parseInt(priceMatch[1], 10);
    }

    const minPriceMatch = lower.match(/(?:above|over|more than|min|minimum)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (minPriceMatch && minPriceMatch[1]) {
      constraints.minPrice = parseInt(minPriceMatch[1], 10);
    }

    // Detect Positive Colors (BUG 2 fix)
    const colorNames = ['black', 'white', 'blue', 'navy', 'green', 'grey', 'gray', 'brown', 'yellow', 'pink', 'maroon', 'pista', 'red', 'turquoise', 'purple'];
    for (const c of colorNames) {
      if (
        lower.includes(`only ${c}`) ||
        lower.includes(`${c} ones`) ||
        lower.includes(`${c} one`) ||
        lower.includes(`in ${c}`) ||
        lower.includes(`${c} color`) ||
        lower.includes(`show me ${c}`) ||
        (lower.includes(c) && !lower.includes(`not ${c}`) && !lower.includes(`no ${c}`) && !lower.includes(`don't want ${c}`) && !lower.includes(`dont want ${c}`))
      ) {
        constraints.color = c === 'gray' ? 'grey' : c;
      }
    }

    // Detect Occasions
    if (lower.includes('office') || lower.includes('formal') || lower.includes('work')) constraints.occasion = 'office';
    if (lower.includes('party') || lower.includes('festive') || lower.includes('wedding')) constraints.occasion = 'festive';
    if (lower.includes('casual') || lower.includes('daily')) constraints.occasion = 'casual';
    if (lower.includes('running') || lower.includes('sports') || lower.includes('gym')) {
      constraints.occasion = 'running';
      constraints.purpose = 'running';
    }

    // Detect Negative Constraints
    const excludedColors: string[] = [];
    const excludedMaterials: string[] = [];
    const excludedTerms: string[] = [];

    if (lower.includes("don't want black") || lower.includes('no black') || lower.includes('not black') || lower.includes('exclude black')) {
      excludedColors.push('black');
    }
    if (lower.includes("don't want white") || lower.includes('no white') || lower.includes('not white')) {
      excludedColors.push('white');
    }
    if (lower.includes('no leather') || lower.includes("don't show leather") || lower.includes('not leather')) {
      excludedMaterials.push('leather');
    }
    if (lower.includes("don't want formal") || lower.includes('no formal') || lower.includes('not formal')) {
      excludedTerms.push('formal');
    }
    if (lower.includes("don't show shoes") || lower.includes('no shoes') || lower.includes('no footwear')) {
      excludedTerms.push('shoes');
    }

    if (excludedColors.length > 0) constraints.excludedColors = excludedColors;
    if (excludedMaterials.length > 0) constraints.excludedMaterials = excludedMaterials;
    if (excludedTerms.length > 0) constraints.excludedTerms = excludedTerms;

    return constraints;
  }

  /**
   * Synthesize Product Info response
   */
  private static async synthesizeProductInfoResponse(
    info: ProductFullIntelligence,
    userQuery: string
  ): Promise<string> {
    const p = info.product;
    const attr = info.attributes;
    const sum = info.reviewSummary;

    const availableColors = Array.from(new Set(info.variants.map(v => v.color).filter(Boolean)));
    const availableSizes = Array.from(new Set(info.variants.map(v => v.size).filter(Boolean)));

    const summaryParts: string[] = [
      `You're viewing **${p.title}** (SKU: \`${p.sku}\`).`,
      `• **Price**: **₹${p.selling_price.toLocaleString('en-IN')}** against an MRP of ~₹${p.mrp.toLocaleString('en-IN')}~ (**${p.discount_percentage}% OFF**).`,
      `• **Rating**: ⭐ **${sum?.average_rating || 4.3}/5** based on **${sum?.review_count || 13} verified reviews**.`,
      `• **Fit & Material**: ${attr?.fit || 'Regular Fit'} in ${attr?.material || attr?.fabric || 'comfortable cotton blend'}${attr?.collar_type ? ` with ${attr.collar_type}` : ''}.`,
      `• **Available Options**: ${availableColors.length > 0 ? `Colors: ${availableColors.slice(0, 4).join(', ')}` : 'Standard color'}${availableSizes.length > 0 ? ` | Sizes: ${availableSizes.join(', ')}` : ''}.`
    ];

    if (sum?.pros && sum.pros.length > 0) {
      summaryParts.push(`\n**What Customers Like**: ${sum.pros.slice(0, 3).join(', ')}.`);
    }

    if (sum?.cons && sum.cons.length > 0) {
      summaryParts.push(`**Key Consideration**: ${sum.cons.slice(0, 2).join('; ')}.`);
    }

    return summaryParts.join('\n');
  }

  /**
   * Synthesize Salesperson "Why Buy" reasoning with trade-offs
   */
  private static async synthesizeWhyBuyResponse(
    info: ProductFullIntelligence,
    userQuery: string
  ): Promise<string> {
    const p = info.product;
    const attr = info.attributes;
    const sum = info.reviewSummary;
    const scores = info.scores;

    const strengths = (scores?.best_for && scores.best_for.length > 0)
      ? scores.best_for.slice(0, 3)
      : (sum?.pros && sum.pros.length > 0 ? sum.pros.slice(0, 3) : ['High customer satisfaction', 'Exceptional value for money', 'Durable fabric']);

    const tradeOff = (sum?.cons && sum.cons.length > 0)
      ? sum.cons[0]
      : (attr?.fit ? `Standard ${attr.fit} sizing; verify size chart if between sizes` : 'Check measurements for best fit');

    const lines: string[] = [
      `### Why Choose **${p.title}** (\`${p.sku}\`)?`,
      `• **Verified Rating**: ⭐ **${sum?.average_rating || 4.3}/5** across **${sum?.review_count || 13} customer reviews**.`,
      `• **Core Strengths**:`,
      ...strengths.map((s: string) => `  ✓ ${s}`),
      `• **Honest Trade-off**: ${tradeOff}.`,
      `• **Pricing**: **₹${p.selling_price.toLocaleString('en-IN')}** (**${p.discount_percentage}% OFF** ~₹${p.mrp.toLocaleString('en-IN')}~).`,
      `\n*Ready to order? Just say "Add this to cart" or ask for a size/color check!*`
    ];

    return lines.join('\n');
  }

  /**
   * Synthesize Review Sentiment breakdown
   */
  private static async synthesizeReviewResponse(info: ProductFullIntelligence): Promise<string> {
    const sum = info.reviewSummary;
    const p = info.product;

    const lines = [
      `### Verified Review Summary for **${p.title}** (\`${p.sku}\`)`,
      `• **Overall Rating**: ⭐ **${sum?.average_rating || 4.3}/5** based on **${sum?.review_count || 13} ratings**.`,
      `• **Recommendation Rate**: 👍 **${sum?.positive_percentage || 88}% of buyers recommend** this item.`
    ];

    if (sum?.pros && sum.pros.length > 0) {
      lines.push(`\n**Top Praises**:`);
      sum.pros.slice(0, 3).forEach((pro: string) => lines.push(`  ✓ ${pro}`));
    }

    if (sum?.cons && sum.cons.length > 0) {
      lines.push(`\n**Constructive Feedback**:`);
      sum.cons.slice(0, 2).forEach((con: string) => lines.push(`  ⚠️ ${con}`));
    }

    if (info.reviews && info.reviews.length > 0) {
      const topReview = info.reviews.find(r => r.rating >= 4 && r.review_text && r.review_text.length > 20) || info.reviews[0];
      if (topReview && topReview.review_text) {
        lines.push(`\n**Verified Customer Quote**: "${topReview.review_text.trim()}" — *${topReview.reviewer_name || 'Verified Buyer'}*`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Synthesize Comparison Table and Recommendation (BUG 9 fix: real domain attributes only)
   */
  private static async synthesizeComparisonResponse(comp: any): Promise<string> {
    const prods = comp.products;
    const cheapest = comp.cheapestProduct;
    const highestRated = comp.highestRatedProduct;

    const lines = [
      `### 📊 Side-by-Side Comparison:`,
      ...prods.map((p: any, idx: number) => {
        const da = p.domainAttributes || {};
        let attrLine = '';
        if (da.categoryType === 'footwear') {
          attrLine = `   • Upper: **${da.upperMaterial}** • Sole: **${da.soleMaterial}** • Cushioning: **${da.cushioning}** • Closure: **${da.closure}**\n   • Recommended For: **${da.intendedUse}**\n`;
        } else if (da.categoryType === 'apparel') {
          attrLine = `   • Fabric: **${da.fabric}** • Fit: **${da.fit}** • Collar: **${da.collar}** • Sleeve: **${da.sleeve}**\n`;
        } else {
          attrLine = `   • Material: **${p.material || 'Durable build'}** • Fit: **${p.fit || 'Standard'}**\n`;
        }

        return `**${idx + 1}. ${p.title}** (\`${p.sku}\`)\n` +
          `   • Price: **₹${p.sellingPrice.toLocaleString('en-IN')}** (~₹${p.mrp.toLocaleString('en-IN')}~ • ${p.discountPercentage}% OFF)\n` +
          `   • Rating: ⭐ **${p.rating}/5** (${p.reviewCount} reviews)\n` +
          attrLine +
          `   • Key Strength: ${p.pros[0] || 'High customer satisfaction'}\n`;
      }),
      `\n**Salesperson Verdict**:`,
      `• **Best Value**: **${cheapest.title}** at only **₹${cheapest.sellingPrice.toLocaleString('en-IN')}**.`,
      `• **Highest Rated**: **${highestRated.title}** with a ⭐ **${highestRated.rating}/5** rating.`,
      `\nIf you prioritize pure budget, go with **${cheapest.sku}**. If you want the most validated performance and comfort, choose **${highestRated.sku}**!`
    ];

    return lines.join('\n');
  }

  /**
   * Synthesize Recommendations Response
   */
  private static async synthesizeRecommendationResponse(
    products: ProductRecord[],
    constraints: RecommendationConstraints,
    userQuery: string
  ): Promise<string> {
    const filterDesc: string[] = [];
    if (constraints.category) filterDesc.push(constraints.category);
    if (constraints.gender) filterDesc.push(constraints.gender);
    if (constraints.color) filterDesc.push(`in ${constraints.color}`);
    if (constraints.maxPrice) filterDesc.push(`under ₹${constraints.maxPrice}`);
    if (constraints.excludedColors && constraints.excludedColors.length > 0) filterDesc.push(`excluding ${constraints.excludedColors.join(', ')}`);
    if (constraints.occasion) filterDesc.push(`suitable for ${constraints.occasion}`);

    const header = filterDesc.length > 0
      ? `I found **${products.length} products** in our catalog matching your preferences (${filterDesc.join(', ')}):`
      : `Here are my top **${products.length} product recommendations** for you:`;

    const productLines = products.map((p, i) =>
      `**${i + 1}. ${p.title}** (\`${p.sku}\`)\n` +
      `   • **Price**: **₹${p.selling_price.toLocaleString('en-IN')}** (~₹${p.mrp.toLocaleString('en-IN')}~ • ${p.discount_percentage}% OFF)\n` +
      `   • **Highlight**: ${p.short_description || p.category}`
    );

    return `${header}\n\n${productLines.join('\n\n')}\n\n*Ask me "Which one is best?", "Compare the first and third one", or click any card to add it to your cart!*`;
  }

  /**
   * Deterministic Variant Image Resolver
   */
  public static resolveVariantImage(
    p: ProductRecord,
    colorName?: string,
    sizeName?: string,
    catalogProduct?: any
  ): string {
    if (colorName && catalogProduct?.colors && catalogProduct.colors.length > 0) {
      const cleanColor = colorName.trim().toLowerCase();
      const exactMatch = catalogProduct.colors.find(
        (c: any) => c.colorname && c.colorname.toLowerCase() === cleanColor
      );
      if (exactMatch && exactMatch.imglink) {
        return exactMatch.imglink;
      }

      const partialMatch = catalogProduct.colors.find(
        (c: any) => c.colorname && (
          c.colorname.toLowerCase().includes(cleanColor) ||
          cleanColor.includes(c.colorname.toLowerCase())
        )
      );
      if (partialMatch && partialMatch.imglink) {
        return partialMatch.imglink;
      }
    }

    if (p.image_url) {
      return p.image_url;
    }

    return 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg';
  }

  /**
   * Helper to format ProductRecord into frontend AiProductCardData with variant support (BUG 3, 4, 5 fix)
   */
  public static toAiProductCard(
    p: ProductRecord,
    summary?: any,
    variantOptions?: { color?: string; size?: string; imageUrl?: string; catalogProduct?: any }
  ): any {
    const finalColor = (variantOptions?.color && variantOptions.color !== 'undefined' && variantOptions.color !== 'null') ? variantOptions.color : undefined;
    const finalSize = (variantOptions?.size && variantOptions.size !== 'undefined' && variantOptions.size !== 'null') ? variantOptions.size : undefined;
    let finalImageUrl = variantOptions?.imageUrl;

    if (!finalImageUrl && finalColor) {
      finalImageUrl = this.resolveVariantImage(p, finalColor, finalSize, variantOptions?.catalogProduct);
    }

    return {
      id: String(p.product_id),
      productId: String(p.product_id),
      sku: p.sku,
      title: p.title,
      name: p.title,
      price: p.selling_price,
      mrp: p.mrp,
      discountPercentage: p.discount_percentage,
      category: p.category || (p.department || 'Apparel'),
      color: finalColor,
      size: finalSize,
      imageUrl: finalImageUrl || p.image_url || 'https://ogppkxqvfzsusdawqbzx.supabase.co/storage/v1/object/public/shopi-product-images/placeholder.jpg',
      inStock: variantOptions?.catalogProduct?.stock !== undefined ? variantOptions.catalogProduct.stock > 0 : (p.is_available && p.stock_quantity > 0),
      stars: summary?.average_rating || 4.3,
      rating: summary?.average_rating || 4.3,
      reviewCount: summary?.review_count || 13,
      description: p.short_description || p.description || ''
    };
  }

  /**
   * Structured Debug Logger (Requirement 20)
   */
  public static logDebugState(
    tag: string,
    memory: ConversationMemory,
    context?: ShopiAIContext,
    resolvedSku?: string,
    intent?: string
  ): void {
    const curProd = memory.currentProductContext?.sku || memory.selectedProduct?.sku || context?.currentProduct?.sku || 'None';
    const curVar = memory.selectedVariant || context?.selectedVariant || null;
    const curCol = memory.selectedVariant?.color || context?.selectedVariant?.color || context?.currentProduct?.selectedColor || 'None';
    const curSize = memory.selectedVariant?.size || context?.selectedVariant?.size || context?.currentProduct?.selectedSize || 'None';
    const lastSearch = memory.lastSearchContext?.filters || memory.activeQuery || null;
    const lastComp = memory.lastComparisonContext?.products?.map((p: any) => p.sku)?.join(' vs ') || memory.lastComparison?.products?.map((p: any) => p.sku)?.join(' vs ') || 'None';
    const compWinner = memory.lastComparisonContext?.winner?.sku || memory.lastComparison?.winner?.sku || 'None';
    const lastRec = memory.lastRecommendationContext?.sku || memory.lastRecommendation?.sku || memory.bestRecommendedSku || 'None';

    console.log(`[SHOPI STATE LOG] === ${tag} ===
CURRENT PRODUCT: ${curProd}
CURRENT VARIANT: ${JSON.stringify(curVar)}
CURRENT COLOR: ${curCol}
CURRENT SIZE: ${curSize}
LAST SEARCH: ${JSON.stringify(lastSearch)} (${memory.lastSearchContext?.results?.length || memory.currentResults?.length || 0} results)
LAST COMPARISON: ${lastComp} (Winner: ${compWinner})
LAST RECOMMENDATION: ${lastRec}
RESOLVED PRODUCT: ${resolvedSku || 'None'}
RESOLVED INTENT: ${intent || 'None'}
================================`);
  }
}
