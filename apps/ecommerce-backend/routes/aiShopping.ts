/**
 * ⚡ Shopi AI Shopping Route (POST /api/ai/chat) - Stateful Conversational Intelligence
 * 
 * Implements:
 * 1. Conversation State Management (persistence of recommendations, cart state, last actions)
 * 2. Intent Classification (ADD_TO_CART_ALL, ADD_TO_CART_SINGLE, COMPARE, REMOVE, SEARCH, etc.)
 * 3. Deterministic Entity & Reference Resolution ("all the results", "that", "the cheaper one", "the second one")
 * 4. Grounded Product Identity & Zero Hallucination
 * 5. Real-Time PostgreSQL Cart Control
 */

import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { RazorpayCommerceAdapter, RealCartState, RealCartItem, UserAddress } from '../ai-adapter/RazorpayCommerceAdapter';
import { rankAndFilterProducts, extractSemanticIntent } from '../ai-adapter/SemanticProductMatcher';
import { conversationManager, CanonicalProduct, ConversationFilters } from '../ai-adapter/ConversationalStateManager';
import { classifyIntent, resolveReferences, ClassifiedIntent } from '../ai-adapter/ConversationalResolver';
import ShopiCatalogService from '../data/shopiCatalogService';

const router = express.Router();
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY as string;
const DEFAULT_DEMO_USER_ID = 666574596;

interface AuthenticatedUserPayload {
  userID: number;
  iat?: number;
  exp?: number;
}

function extractAuthenticatedUserID(req: Request): number | null {
  try {
    const authHeader = req.headers['authorization'];
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.headers['x-user-token']) {
      token = req.headers['x-user-token'] as string;
    }

    if (!token || !JWT_SECRET) return null;

    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUserPayload;
    return decoded.userID || null;
  } catch {
    return null;
  }
}

function formatCartItemList(items: RealCartItem[]): string {
  return items.map(i => `• ${i.name} ×${i.quantity} — ₹${i.price.toLocaleString('en-IN')}`).join('\n');
}

/**
 * ── CART INTENT DETECTION (scored, order-insensitive) ─────────────────────────
 *
 * Bug this fixes: "what is in my cart?" matched the old exact-phrase list, but
 * any other phrasing — "what do I have in my cart?", "how many items are in my
 * cart?", "what have I added?", "what am I buying?", "show the items I added" —
 * fell through to PRODUCT SEARCH, which searched the catalog for the keyword
 * "cart" and returned random products.
 *
 * This detector scores cart-view questions so ANY phrasing that is genuinely
 * about the user's cart is routed to cart_view and answered from the REAL
 * cart database — never a keyword product search.
 */
const CART_VIEW_STRONG_PATTERNS: Array<[RegExp, number]> = [
  // Direct "cart/bag contents" questions — near-certain
  [/\bin (?:my|the) (?:cart|bag|basket|trolley)\b/, 5],
  [/\b(?:cart|bag|basket|trolley) (?:contents?|items?|list)\b/, 5],
  [/\bmy (?:cart|bag|basket|trolley)\b/, 4],
  [/\b(?:whats|what's|what is|what do|what did|what have|what am|whats)\b.*\b(?:cart|bag|basket|trolley)\b/, 5],
  [/\b(?:show|display|list|open|see|check)\b.*\b(?:cart|bag|basket|trolley)\b/, 4],
  [/\b(?:added|put|placed)\b.*\b(?:in|to|into) (?:my |the )?(?:cart|bag|basket|trolley)\b/, 4],
  [/\b(?:how many|what) (?:items?|products?|things?)\b.*\b(?:cart|bag|basket|trolley)\b/, 5],
  [/\b(?:cart|bag)\b.*\btotal\b/, 5],
  [/\bhow much\b.*\b(?:cart|bag|basket|trolley)\b/, 4],
  [/\bwhat am i (?:buying|purchasing)\b/, 4],
  // Added-items questions WITHOUT the word "cart" (still unambiguous)
  [/\bwhat (?:have i|did i) (?:added|put|placed|put)\b/, 4],
  [/\b(?:show|list) (?:me )?(?:the )?items? i (?:added|put|have)\b/, 4],
  [/\bwhat products? did i add\b/, 4],
  // Bare single-word cart commands
  [/^\s*(?:cart|bag|basket|show cart|view cart|my cart|cart\?)\s*[?.!]?\s*$/, 5],
];

/** Mutating cart commands must NEVER be treated as a read-only view question. */
const CART_VIEW_EXCLUDE_PATTERNS: RegExp[] = [
  /\b(?:clear|empty|reset|remove|delete|drop|cancel)\b.*\b(?:cart|bag|basket|trolley|it|this)\b/,
  /^\s*(?:clear|empty|reset)\s+(?:my\s+)?(?:cart|bag|basket)\s*$/,
  // Add-to-cart commands mention "cart" too — they must route to ADD, not VIEW.
  /\b(?:add|put|buy|get|order)\b.*\b(?:to|in|into|into)\b.*\b(?:cart|bag|basket|trolley)\b/,
  /\b(?:add|put|buy|get)\s+(?:this|it|them|the)\b/,
  /^\s*add\s+/,
  /\bremove\b/,
  /\bcheckout\b/,
  /\bpay (?:now|via|using)\b/,
  /\b(?:increase|decrease|change|update|set)\b.*\b(?:quantity|qty|of)\b/,
  /\bmake it\b/,
];

function scoreCartViewIntent(lowerMsg: string): number {
  for (const ex of CART_VIEW_EXCLUDE_PATTERNS) {
    if (ex.test(lowerMsg)) return 0;
  }
  let score = 0;
  for (const [pattern, weight] of CART_VIEW_STRONG_PATTERNS) {
    if (pattern.test(lowerMsg)) score += weight;
  }
  return score;
}

/** True when the message is a cart-view question (threshold tuned so a single
 *  strong phrase is enough; generic product searches mentioning the word
 * "cart" alone (e.g. "do you sell shopping carts?") score 0–1 and stay out). */
function isCartViewQuestion(lowerMsg: string): boolean {
  return scoreCartViewIntent(lowerMsg) >= 4;
}

function toCanonicalProduct(p: any): CanonicalProduct {
  const priceVal = typeof p.price === 'number'
    ? p.price
    : parseFloat(p.price?.amount || p.discount || p.price || 0);

  const rawId = String(p.id || p.productid || p.productId || '');

  return {
    id: rawId,
    productId: rawId,
    title: p.name || p.title || '',
    name: p.name || p.title || '',
    price: priceVal,
    currency: p.price?.currency || p.currency || 'INR',
    category: p.category || (p.categories ? p.categories.subcategory || p.categories.maincategory : undefined),
    imageUrl: p.imageUrl || p.imglink || '',
    inStock: p.inStock ?? (p.stock === undefined || p.stock > 0),
    stars: p.stars || 0,
    rating: p.rating || p.reviewCount || 0,
    description: p.description || '',
  };
}

import { SalespersonEngine, ShopiAIContext, getOrCreateMemory } from '../shopi-assistant/salespersonEngine';
import { ProductIntelligenceService } from '../shopi-assistant/productIntelligence';

/**
 * POST /api/ai/chat
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { message, userId, conversationId, context } = req.body as {
    message: string;
    userId?: number;
    conversationId?: string;
    context?: ShopiAIContext;
  };

  // 1. Validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a non-empty string.',
    });
  }

  const cleanMessage = message.trim();
  const lowerMessage = cleanMessage.toLowerCase();
  const authUserId = extractAuthenticatedUserID(req);
  const isAuthUser = Boolean(authUserId || (userId && typeof userId === 'number' && userId > 0));
  const targetUserId = authUserId || (typeof userId === 'number' ? userId : parseInt(String(userId || ''), 10)) || DEFAULT_DEMO_USER_ID;

  try {
    const adapter = new RazorpayCommerceAdapter({
      // Public storefront host (scheme stripped) — env-driven so production
      // emails/CTAs never carry localhost.
      domain: (process.env.STOREFRONT_BASE_URL || process.env.FRONTEND_SERVER_ORIGIN || 'https://shopi-ai-commerce-platform-shop-two.vercel.app').split(',')[0].trim().replace(/^https?:\/\//, '').replace(/\/+$/, ''),
      merchantName: 'Razorpay AI Commerce',
      defaultCurrency: 'INR',
    });

    let currentCart: RealCartState = await adapter.getCart(targetUserId);

    // ──────────────────────────────────────────────────────────────────────────
    // 2. CHECKOUT & COMMERCE ACTIONS
    // ──────────────────────────────────────────────────────────────────────────
    if (lowerMessage === 'checkout' || lowerMessage.includes('proceed to checkout') || lowerMessage.includes('pay now') || /\b(?:i want|i'd like|i would like|let me|help me|take me)\b.*\bcheckout\b/.test(lowerMessage) || /\bcheckout\b.*\?*$/.test(lowerMessage) && !lowerMessage.includes('where')) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'checkout',
          message: 'Your cart is currently empty. Please add a product before checking out.',
          products: [],
          cart: currentCart,
          checkout: {
            available: false,
            url: '/cart-checkout',
            isCartEmpty: true,
            itemCount: 0,
            total: 0,
          },
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const itemLines = currentCart.items
        .map((i: RealCartItem) => `• ${i.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
        .join('\n');

      return res.status(200).json({
        success: true,
        intent: 'checkout',
        message: `You're ready to checkout! 🛒\n\nYour cart:\n${itemLines}\n\n**Total**: ₹${currentCart.total.toLocaleString('en-IN')} INR\n\n*Click below to proceed to the secure checkout page.*`,
        products: [],
        cart: currentCart,
        checkout: {
          available: true,
          url: '/cart-checkout',
          isCartEmpty: false,
          itemCount: currentCart.itemCount,
          total: currentCart.total,
        },
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // ── Delivery Address Management ──
    if (lowerMessage.includes('delivery address') || lowerMessage.includes('shipping address') || lowerMessage.includes('change address') || lowerMessage.includes('update address')) {
      const addresses = await adapter.getUserAddresses(targetUserId);

      if (addresses.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'address_update',
          message: "You don't have any saved delivery addresses yet. You can add or edit your address during checkout or update your profile settings.",
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
          audit: {
            intent: 'ADDRESS_UPDATE',
            toolsUsed: ['get_delivery_address'],
            evidenceSummary: 'Queried delivery addresses'
          }
        });
      }

      const formatted = addresses.map((addr, idx) => {
        const def = addr.is_default ? ' ⭐ (Default)' : '';
        return `**${idx + 1}. ${addr.userName}**${def}\n   ${addr.addressLine1}${addr.addressLine2 ? ', ' + addr.addressLine2 : ''}\n   ${addr.city}, ${addr.state} - ${addr.postalCode}`;
      }).join('\n\n');

      return res.status(200).json({
        success: true,
        intent: 'address_update',
        message: `Here are your current delivery addresses:\n\n${formatted}\n\nTo change or set your primary delivery destination, select one during checkout or update your account address book.`,
        addresses,
        selectedAddress: addresses.find(a => a.is_default) || addresses[0],
        products: [],
        cart: currentCart,
        checkout: { available: true, url: '/cart-checkout' },
        userId: targetUserId,
        conversationId: conversationId || undefined,
        audit: {
          intent: 'ADDRESS_UPDATE',
          toolsUsed: ['get_delivery_address'],
          evidenceSummary: `Found ${addresses.length} saved addresses`
        }
      });
    }

    // ── Clear / Reset Cart ("Clear my cart", "Empty my cart", "Reset demo cart") ──
    if (lowerMessage === 'clear cart' || lowerMessage === 'empty cart' || lowerMessage.includes('clear my cart') || lowerMessage.includes('empty my cart') || lowerMessage.includes('reset cart')) {
      const clearRes = await adapter.clearCart(targetUserId);
      currentCart = clearRes.cart;
      return res.status(200).json({
        success: true,
        intent: 'clear_cart',
        message: 'Your shopping cart has been cleared. 🛒 (0 items • ₹0 INR)',
        products: [],
        cart: currentCart,
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // ── View Cart (scored detection — catches ANY cart question phrasing) ──
    // Replaces the fragile exact-phrase list: "what do I have in my cart?",
    // "how many items are in my cart?", "what have I added?" etc. previously
    // fell through to product SEARCH, which searched the catalog for the
    // keyword "cart" and returned random products.
    if (isCartViewQuestion(lowerMessage)) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'cart_view',
          message: 'Your shopping cart is currently empty. 🛒\n\nTell me what you are looking for (e.g. "show me sports shoes under ₹2000") and I can add it for you.',
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const itemLines = currentCart.items
        .map((i: RealCartItem) => {
          const varDetails = [i.color, i.size].filter(Boolean).join(' / ');
          const varTag = varDetails ? ` (${varDetails})` : '';
          const subtotal = i.price * i.quantity;
          return `• **${i.name}**${varTag} — Qty ${i.quantity} × ₹${i.price.toLocaleString('en-IN')} = **₹${subtotal.toLocaleString('en-IN')}**`;
        })
        .join('\n');

      return res.status(200).json({
        success: true,
        intent: 'cart_view',
        message: `Your shopping cart has **${currentCart.itemCount} item(s)**:\n\n${itemLines}\n\n**Cart Total**: ₹${currentCart.total.toLocaleString('en-IN')} INR\n\n*Would you like to proceed to checkout?*`,
        products: [],
        cart: currentCart,
        checkout: { available: true, url: '/cart-checkout', isCartEmpty: false, itemCount: currentCart.itemCount, total: currentCart.total },
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // ── Remove from Cart ("Remove it", "Remove this from cart", "Remove the shirt", "Remove the shoe") ──
    const isCartRemoveCommand = (
      lowerMessage.includes('remove from cart') ||
      lowerMessage.includes('remove this') ||
      lowerMessage === 'remove it' ||
      lowerMessage === 'remove it.' ||
      lowerMessage.startsWith('remove ') ||
      lowerMessage.includes('delete from cart') ||
      lowerMessage.includes('take it out')
    );

    if (isCartRemoveCommand) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'remove_from_cart',
          message: 'Your shopping cart is currently empty.',
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const memory = getOrCreateMemory(conversationId || 'default_conv', targetUserId);
      const targetSku = SalespersonEngine.resolveTargetSku(cleanMessage, context, memory);

      // Find item in cart matching SKU or name or ID, or fallback to most recent item
      let itemToRemove = currentCart.items[currentCart.items.length - 1];

      if (targetSku) {
        const matched = currentCart.items.find(i => 
          i.productId.toUpperCase() === targetSku.toUpperCase() ||
          (i.name || '').toLowerCase().includes(targetSku.toLowerCase())
        );
        if (matched) itemToRemove = matched;
      } else if (lowerMessage.includes('shoe')) {
        const matchedShoe = currentCart.items.find(i => (i.name || '').toLowerCase().includes('shoe') || (i.category || '').toLowerCase().includes('shoe') || (i.category || '').toLowerCase().includes('sneaker'));
        if (matchedShoe) itemToRemove = matchedShoe;
      } else if (lowerMessage.includes('shirt')) {
        const matchedShirt = currentCart.items.find(i => (i.name || '').toLowerCase().includes('shirt') || (i.category || '').toLowerCase().includes('shirt'));
        if (matchedShirt) itemToRemove = matchedShirt;
      }

      if (itemToRemove) {
        const remRes = await adapter.removeFromCart(targetUserId, itemToRemove.cartItemId);
        currentCart = remRes.cart;

        const remainingMsg = currentCart.items.length === 0
          ? 'Your shopping cart is now empty.'
          : `Your cart now has **${currentCart.itemCount} item(s)** totaling **₹${currentCart.total.toLocaleString('en-IN')} INR**.`;

        return res.status(200).json({
          success: true,
          intent: 'remove_from_cart',
          message: `Removed **${itemToRemove.name}** from your cart. 🗑️\n\n${remainingMsg}`,
          products: [],
          cart: currentCart,
          checkout: { available: currentCart.items.length > 0, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
          audit: {
            intent: 'CART_REMOVE',
            resolvedSku: itemToRemove.productId,
            toolsUsed: ['remove_from_cart'],
            evidenceSummary: `Removed product ID ${itemToRemove.productId} from user ${targetUserId} cart`
          }
        });
      }
    }

    // ── Update Cart Quantity ("Make it two", "Increase the quantity", "Decrease by one") ──
    const isQtyUpdate = (
      lowerMessage.includes('make it') ||
      lowerMessage.includes('change quantity') ||
      lowerMessage.includes('change the quantity') ||
      lowerMessage.includes('set quantity') ||
      /make (?:the |its? )?quantity/.test(lowerMessage) ||
      /update (?:the )?quantity/.test(lowerMessage) ||
      /quantity to \d/.test(lowerMessage) ||
      /\b(?:increase|decrease|reduce)\b.*\b(?:quantity|qty|it)\b/.test(lowerMessage) ||
      /\b(?:buy|get|order)\s+(?:more|less|one more)\b/.test(lowerMessage)
    );

    if (isQtyUpdate) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length > 0) {
        const targetItem = currentCart.items[currentCart.items.length - 1];

        // Directional verbs (increase/decrease/reduce) adjust RELATIVE to the
        // current quantity; absolute phrasings ("make it two", "quantity to 3")
        // set it directly. Previously "increase the quantity" defaulted to 2
        // regardless of the existing quantity.
        const isIncrease = /\b(?:increase|more|one more|add one)\b/.test(lowerMessage);
        const isDecrease = /\b(?:decrease|reduce|less|one less|remove one)\b/.test(lowerMessage);
        let newQty: number;
        // Strip SKU-like tokens before extracting a quantity — otherwise
        // "change the quantity of SNEAKER-005 to 2" would read the SKU's
        // digits as the quantity (same class of bug as the add path).
        const msgWithoutSkus = lowerMessage.replace(/\b[A-Z]+-?\d+(?:[A-Z-]*\d*)*\b/gi, '').replace(/\b\d+-[A-Z]+\b/gi, '');
        const qtyMatch = msgWithoutSkus.match(/\b(\d+)\b/) || (msgWithoutSkus.includes('two') ? [null, '2'] : msgWithoutSkus.includes('three') ? [null, '3'] : msgWithoutSkus.includes('one') ? [null, '1'] : null);

        if (isIncrease && !qtyMatch) {
          newQty = targetItem.quantity + 1;
        } else if (isDecrease && !qtyMatch) {
          newQty = Math.max(1, targetItem.quantity - 1);
        } else if (isIncrease && qtyMatch) {
          newQty = targetItem.quantity + parseInt(qtyMatch[1], 10);
        } else if (isDecrease && qtyMatch) {
          newQty = Math.max(1, targetItem.quantity - parseInt(qtyMatch[1], 10));
        } else {
          newQty = qtyMatch && qtyMatch[1] ? parseInt(qtyMatch[1], 10) : 2;
        }
        newQty = Math.min(10, Math.max(1, newQty)); // storefront limit 1-10

        await adapter.updateCartQuantity(targetUserId, targetItem.cartItemId, newQty);
        currentCart = await adapter.getCart(targetUserId);

        return res.status(200).json({
          success: true,
          intent: 'update_cart',
          message: `Updated quantity for **${targetItem.name}** to **${newQty}**! 🛒\n\nYour cart now has **${currentCart.itemCount} item(s)** totaling **₹${currentCart.total.toLocaleString('en-IN')} INR**.`,
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
          audit: {
            intent: 'CART_UPDATE',
            toolsUsed: ['update_cart_item'],
            evidenceSummary: `Updated quantity to ${newQty} for cart item ${targetItem.cartItemId}`
          }
        });
      }
    }

    // Quantity update requested but the cart is EMPTY — guide instead of the
    // generic fallback (previously "increase the quantity" with an empty cart
    // landed in general_guidance, which confused users).
    if (isQtyUpdate && currentCart.items.length === 0) {
      return res.status(200).json({
        success: true,
        intent: 'update_cart',
        message: 'Your shopping cart is currently empty, so there is nothing to adjust. 🛒\n\nTell me what you would like (e.g. "show me sports shoes under ₹2000") and I can add it for you.',
        products: [],
        cart: currentCart,
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // ── Add to Cart ("Add this to cart", "Add the green one in M", "Add the better one", "Add SHIRT-002") ──
    const isCartAddCommand = (
      (lowerMessage.includes('add to cart') ||
       lowerMessage.includes('add this to cart') ||
       lowerMessage.includes('add this to bag') ||
       lowerMessage.includes('put this in cart') ||
       lowerMessage.includes('add this') ||
       lowerMessage.startsWith('add ') ||
       lowerMessage.includes('add the ') ||
       lowerMessage.includes('buy this') ||
       lowerMessage === 'add to cart') &&
      !lowerMessage.includes('why') &&
      !lowerMessage.includes('should i') &&
      !lowerMessage.includes('how') &&
      !lowerMessage.includes('tell me') &&
      !lowerMessage.includes('what') &&
      !lowerMessage.includes('does it come') &&
      !lowerMessage.includes('is it available')
    );

    if (isCartAddCommand) {
      const memory = getOrCreateMemory(conversationId || 'default_conv', targetUserId);
      let targetSku = SalespersonEngine.resolveTargetSku(cleanMessage, context, memory);

      // Fallback 1: full catalog title search (e.g. "add the Centrino Men's Glossy Formal Shoes to my cart")
      if (!targetSku) {
        const stripWords = (s: string) =>
          s.replace(/\b(please|can you|could you|i want to|i want|add|put|place|buy|the|to|into|in|my|cart|bag|a|an|one|item|product|order)\b/gi, ' ').replace(/\s+/g, ' ').trim();
        const q = stripWords(cleanMessage);
        if (q.length >= 6) {
          const search = await SalespersonEngine.processMessage(q, context, conversationId, targetUserId);
          const hit = (search.products || []).find((p: any) => {
            const t = (p.title || p.name || '').toLowerCase();
            const qq = q.toLowerCase();
            return t && (t.includes(qq) || qq.includes(t));
          });
          if (hit?.sku) targetSku = String(hit.sku);
          else if (((search.products as any[]) || []).length === 1) targetSku = String((search.products as any[])[0].sku || (search.products as any[])[0].productId);
        }
      }

      // Fallback 2: last-discussed / last-added product in this conversation
      if (!targetSku) {
        targetSku = memory.lastDiscussedSku || memory.lastAddedSku || memory.bestRecommendedSku || undefined;
      }

      if (targetSku) {
        const prodInfo = await ProductIntelligenceService.getProductBySkuOrId(targetSku);

        if (prodInfo) {
          const prod = prodInfo.product;
          memory.lastAddedSku = prod.sku;
          memory.lastDiscussedSku = prod.sku;
          memory.lastDiscussedTitle = prod.title;

          // Check if item is already in user's cart before add
          const prevCart = await adapter.getCart(targetUserId);
          const existingItem = prevCart.items.find(i => 
            i.productId.toUpperCase() === prod.sku.toUpperCase() ||
            (i.name || '').toLowerCase() === (prod.title || '').toLowerCase()
          );

          // Resolve requested quantity (e.g. "Add 2 of this" -> 2, default 1).
          // BUG FIX: the raw /\b\d+\b/ match previously captured digits inside
          // SKU tokens ("add SNEAKER-005" -> quantity 5!). Strip SKU-like
          // tokens before looking for a standalone quantity number.
          const msgWithoutSkus = lowerMessage.replace(/\b[A-Z]+-?\d+(?:[A-Z-]*\d*)*\b/gi, '').replace(/\b\d+-[A-Z]+\b/gi, '');
          const qtyMatch = msgWithoutSkus.match(/\b(\d+)\b/) ||
            (msgWithoutSkus.includes('two') ? [null, '2'] : msgWithoutSkus.includes('three') ? [null, '3'] : null);
          const addQty = qtyMatch && qtyMatch[1] ? Math.max(1, parseInt(qtyMatch[1], 10)) : 1;

          // Grounded variant resolution
          const catalogProd = await ShopiCatalogService.getProduct(prod.sku);
          const validColors = (catalogProd?.colors && catalogProd.colors.length > 0)
            ? catalogProd.colors.map((c: any) => c.colorname)
            : prodInfo.variants.filter(v => v.color && v.color.toLowerCase() !== 'null').map(v => v.color!.trim());
          const validSizes = (catalogProd?.sizes && catalogProd.sizes.length > 0)
            ? catalogProd.sizes.map((s: any) => s.sizename)
            : prodInfo.variants.filter(v => v.size && v.size.toLowerCase() !== 'null').map(v => v.size!.trim());

          // 1. Explicit color in user message
          let explicitColor: string | undefined = undefined;
          if (lowerMessage.includes('navy')) explicitColor = 'Navy Blue';
          else if (lowerMessage.includes('sky')) explicitColor = 'Sky Blue';
          else if (lowerMessage.includes('blue')) explicitColor = 'Navy Blue';
          else if (lowerMessage.includes('maroon') || lowerMessage.includes('brown')) explicitColor = 'Maroon';
          else if (lowerMessage.includes('black')) explicitColor = 'Black';
          else if (lowerMessage.includes('green')) explicitColor = 'Green';
          else if (lowerMessage.includes('white')) explicitColor = 'White';
          else if (lowerMessage.includes('pink')) explicitColor = 'Pink';
          else if (lowerMessage.includes('pista')) explicitColor = 'Pista';
          else if (lowerMessage.includes('yellow')) explicitColor = 'Yellow';
          else if (lowerMessage.includes('red')) explicitColor = 'Red';

          // 1. Explicit size in user message
          let explicitSize: string | undefined = undefined;
          const sizeMatch = lowerMessage.match(/\b(in|size)\s*(\d*xl|2xl|3xl|xl|l|m|s|xs)\b/i);
          if (sizeMatch && sizeMatch[2]) {
            explicitSize = sizeMatch[2].toUpperCase();
          } else if (lowerMessage.includes(' in m') || lowerMessage.includes(' size m') || lowerMessage.endsWith(' in m') || lowerMessage.endsWith(' m')) {
            explicitSize = 'M';
          } else if (lowerMessage.includes(' in l') || lowerMessage.includes(' size l') || lowerMessage.endsWith(' in l') || lowerMessage.endsWith(' l')) {
            explicitSize = 'L';
          } else if (lowerMessage.includes(' in s') || lowerMessage.includes(' size s') || lowerMessage.endsWith(' in s') || lowerMessage.endsWith(' s')) {
            explicitSize = 'S';
          } else if (lowerMessage.includes(' in xl') || lowerMessage.includes(' size xl') || lowerMessage.endsWith(' in xl') || lowerMessage.endsWith(' xl')) {
            explicitSize = 'XL';
          }

          let chosenColor: string | undefined = explicitColor;
          if (!chosenColor) {
            if (memory.selectedVariant?.color) {
              chosenColor = memory.selectedVariant.color;
            } else if (context?.selectedVariant?.color || context?.currentProduct?.selectedColor) {
              chosenColor = context?.selectedVariant?.color || context?.currentProduct?.selectedColor;
            } else if (memory.currentProductContext?.color) {
              chosenColor = memory.currentProductContext.color;
            } else if (memory.lastDiscussedVariant?.color) {
              chosenColor = memory.lastDiscussedVariant.color;
            }
          }

          if (chosenColor && (chosenColor.toLowerCase() === 'undefined' || chosenColor.toLowerCase() === 'null')) {
            chosenColor = undefined;
          }

          if (!chosenColor || !validColors.some((c: any) => String(c).toLowerCase() === chosenColor!.toLowerCase())) {
            chosenColor = validColors.length > 0 ? validColors[0] : undefined;
          }

          let chosenSize: string | undefined = explicitSize;
          if (!chosenSize) {
            if (memory.selectedVariant?.size) {
              chosenSize = memory.selectedVariant.size;
            } else if (context?.selectedVariant?.size || context?.currentProduct?.selectedSize) {
              chosenSize = context?.selectedVariant?.size || context?.currentProduct?.selectedSize;
            } else if (memory.currentProductContext?.size) {
              chosenSize = memory.currentProductContext.size;
            } else if (memory.lastDiscussedVariant?.size) {
              chosenSize = memory.lastDiscussedVariant.size;
            }
          }

          if (chosenSize && (chosenSize.toLowerCase() === 'undefined' || chosenSize.toLowerCase() === 'null')) {
            chosenSize = undefined;
          }

          if (!chosenSize || !validSizes.some((s: any) => String(s).toLowerCase() === chosenSize!.toLowerCase())) {
            chosenSize = validSizes.length > 0 ? (validSizes.includes('S') ? 'S' : validSizes[0]) : undefined;
          }

          const addRes = await adapter.addToCart(
            targetUserId,
            String(prod.product_id),
            addQty,
            undefined,
            undefined,
            chosenColor,
            chosenSize
          );
          currentCart = addRes.cart;

          const updatedItem = currentCart.items.find(i => 
            (i.productId.toUpperCase() === prod.sku.toUpperCase() || (i.name || '').toLowerCase() === (prod.title || '').toLowerCase()) &&
            (!chosenColor || (i.color || '').toLowerCase() === chosenColor.toLowerCase()) &&
            (!chosenSize || (i.size || '').toLowerCase() === chosenSize.toLowerCase())
          ) || addRes.addedItem;
          const resultingQty = updatedItem ? updatedItem.quantity : addQty;

          const variantDesc = [
            chosenColor ? `**${chosenColor}**` : null,
            chosenSize ? `Size **${chosenSize}**` : null
          ].filter(Boolean).join(', ');
          const variantTag = variantDesc ? ` — ${variantDesc} —` : '';

          let confirmationMsg = '';
          if (existingItem && (!chosenColor || existingItem.color === chosenColor)) {
            confirmationMsg = `Added another **${prod.title}** (\`${prod.sku}\`${variantTag}) to your cart! You now have **${resultingQty}** in your cart. 🛍️\n\nYour cart now has **${currentCart.itemCount} item(s)** totaling **₹${currentCart.total.toLocaleString('en-IN')} INR**.`;
          } else {
            confirmationMsg = `Added **${prod.title}**${variantTag} to your cart! 🛍️\n\nYour cart now has **${currentCart.itemCount} item(s)** totaling **₹${currentCart.total.toLocaleString('en-IN')} INR**.`;
          }

          const card = SalespersonEngine.toAiProductCard(prod, prodInfo.reviewSummary, {
            color: chosenColor,
            size: chosenSize,
            imageUrl: memory.selectedVariant?.imageUrl || memory.currentProductContext?.imageUrl,
            catalogProduct: catalogProd
          });

          console.log(`[SHOPI CART DEBUG]
CURRENT PRODUCT: ${prod.sku}
CURRENT VARIANT: ${chosenColor || 'None'} / ${chosenSize || 'None'}
CURRENT COLOR: ${chosenColor || 'None'}
CURRENT SIZE: ${chosenSize || 'None'}
RESOLVED VARIANT IMAGE: ${card.imageUrl}
CART ITEM: ${updatedItem?.name} — ${updatedItem?.color || 'Standard'}, Size ${updatedItem?.size || 'Standard'} (Qty: ${resultingQty})`);

          return res.status(200).json({
            success: true,
            intent: 'add_to_cart',
            message: confirmationMsg,
            products: [card],
            cart: currentCart,
            checkout: { available: true, url: '/cart-checkout' },
            userId: targetUserId,
            conversationId: conversationId || undefined,
            audit: {
              intent: 'CART_ADD',
              resolvedSku: prod.sku,
              toolsUsed: ['get_product', 'add_to_cart'],
              evidenceSummary: `Added product ${prod.sku} (Variant: ${chosenColor || 'Default'} / ${chosenSize || 'Default'}) to user ${targetUserId} cart`
            }
          });
        }

        // Resolved a SKU but the product lookup failed — be honest, never claim success
        return res.status(200).json({
          success: false,
          intent: 'add_to_cart_failed',
          message: `I couldn't find that product in the catalog (\`${targetSku}\`), so nothing was added to your cart. Could you tell me the product name or SKU again?`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
          audit: {
            intent: 'CART_ADD_FAILED',
            resolvedSku: targetSku,
            toolsUsed: ['get_product'],
            evidenceSummary: `Product lookup failed for ${targetSku}; cart unchanged`
          }
        });
      }

      // An add-to-cart command was detected but no product could be resolved.
      // NEVER fall through to a generic search here — tell the user honestly.
      return res.status(200).json({
        success: false,
        intent: 'add_to_cart_failed',
        message: currentCart.items.length > 0
          ? "I'm not sure which product you'd like to add. You can say **\"add the first one\"**, **\"add the second one\"**, mention a product name, or use the **+ Add to Cart** button on any product card above."
          : "I'm not sure which product you'd like to add. Tell me what you're looking for first (e.g. *\"black formal shoes under ₹1000\"*), then say **\"add the first one\"** or use the **+ Add to Cart** button on a product card.",
        products: [],
        cart: currentCart,
        userId: targetUserId,
        conversationId: conversationId || undefined,
        audit: {
          intent: 'CART_ADD_FAILED',
          toolsUsed: [],
          evidenceSummary: 'No product reference could be resolved from the add-to-cart command; cart unchanged'
        }
      });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // 3. DELEGATE TO TRUE SALESPERSON ENGINE
    // ──────────────────────────────────────────────────────────────────────────
    const salespersonResult = await SalespersonEngine.processMessage(
      cleanMessage,
      context,
      conversationId,
      targetUserId
    );

    return res.status(200).json({
      success: true,
      intent: salespersonResult.intent,
      message: salespersonResult.message,
      products: salespersonResult.products || [],
      cart: currentCart,
      checkout: salespersonResult.checkout || { available: currentCart.items.length > 0, url: '/cart-checkout' },
      addresses: salespersonResult.addresses,
      selectedAddress: salespersonResult.selectedAddress,
      userId: targetUserId,
      conversationId: conversationId || undefined,
      audit: salespersonResult.audit
    });
  } catch (error: any) {
    console.error('[Shopi AI Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your AI shopping request.',
    });
  }
});

export default router;
