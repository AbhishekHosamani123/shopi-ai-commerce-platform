/**
 * ⚡ Shopi AI Shopping Route (POST /api/ai/chat) - Real Cart Control & Intent Resolution
 * 
 * Powered by Shopi ShoppingAgent + Groq LLM + RazorpayCommerceAdapter.
 * Connects natural language user prompts directly to the real 40 products
 * and PostgreSQL `cartitems` table in the `razorpay_ecommerce` database.
 */

import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { ShoppingAgent } from '../../../packages/shopping-engine/src/agent/shopping-agent.js';
import type { AgentPlugin } from '../../../packages/shopping-engine/src/types/index.js';
import { RazorpayCommerceAdapter, RealCartState, RealCartItem, UserAddress } from '../ai-adapter/RazorpayCommerceAdapter';
import { GroqAdapter } from '../ai-adapter/GroqAdapter';
import { rankAndFilterProducts, extractSemanticIntent } from '../ai-adapter/SemanticProductMatcher';

const router = express.Router();
const JWT_SECRET = process.env.JWT_ENCRYPTION_KEY as string;

// Default demo user ID in PostgreSQL database for unauthenticated / testing requests
const DEFAULT_DEMO_USER_ID = 666574596;

interface AuthenticatedUserPayload {
  userID: number;
  iat?: number;
  exp?: number;
}

interface ConversationSession {
  lastProducts: any[];
  lastQuery?: string;
  lastActiveProduct?: any;
  updatedAt: number;
}

// In-memory conversation context store for active recommendations, relative selection resolution & cart context
const conversationSessions = new Map<string, ConversationSession>();

function getSessionKey(conversationId?: string, userId?: number): string {
  if (conversationId && typeof conversationId === 'string' && conversationId.trim().length > 0) {
    return conversationId.trim();
  }
  if (userId) {
    return `user_${userId}`;
  }
  return 'default_session';
}

function getSession(conversationId?: string, userId?: number): ConversationSession | undefined {
  const key = getSessionKey(conversationId, userId);
  const session = conversationSessions.get(key);
  if (!session) return undefined;
  // 30-minute session TTL
  if (Date.now() - session.updatedAt > 30 * 60 * 1000) {
    conversationSessions.delete(key);
    return undefined;
  }
  return session;
}

function updateSession(
  conversationId: string | undefined,
  userId: number | undefined,
  update: {
    lastProducts?: any[];
    lastQuery?: string;
    lastActiveProduct?: any;
  }
) {
  const key = getSessionKey(conversationId, userId);
  const existing = conversationSessions.get(key);
  conversationSessions.set(key, {
    lastProducts: update.lastProducts !== undefined ? update.lastProducts : (existing?.lastProducts || []),
    lastQuery: update.lastQuery !== undefined ? update.lastQuery : existing?.lastQuery,
    lastActiveProduct: update.lastActiveProduct !== undefined ? update.lastActiveProduct : existing?.lastActiveProduct,
    updatedAt: Date.now(),
  });
}

function parseNaturalNumber(text?: string): number | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();
  const digitMatch = t.match(/\d+/);
  if (digitMatch) return parseInt(digitMatch[0], 10);
  const words: Record<string, number> = {
    'one': 1, 'a': 1, 'an': 1, 'another': 1,
    'two': 2, 'couple': 2,
    'three': 3,
    'four': 4,
    'five': 5,
    'six': 6,
    'seven': 7,
    'eight': 8,
    'nine': 9,
    'ten': 10,
  };
  return words[t] !== undefined ? words[t] : null;
}

function formatCartItemList(items: RealCartItem[]): string {
  return items.map(i => `• ${i.name} ×${i.quantity} — ₹${i.price}`).join('\n');
}

interface CartItemResolution {
  matchedItem?: RealCartItem;
  ambiguousMatches?: RealCartItem[];
  isAmbiguous: boolean;
  notFound: boolean;
  reason?: string;
}

/**
 * Resolves a natural language cart item reference against the user's CURRENT REAL CART.
 */
function resolveTargetCartItem(
  targetText: string,
  currentCart: RealCartState,
  lastActiveProduct?: any
): CartItemResolution {
  if (currentCart.items.length === 0) {
    return { isAmbiguous: false, notFound: true, reason: 'Cart is empty' };
  }

  const rawLower = (targetText || '').toLowerCase().trim();

  // 1. Relative price selectors in current cart
  if (/(?:cheapest|lowest\s+price|least\s+expensive)/i.test(rawLower)) {
    const sorted = [...currentCart.items].sort((a, b) => a.price - b.price);
    return { matchedItem: sorted[0], isAmbiguous: false, notFound: false };
  }
  if (/(?:most\s+expensive|highest\s+price|priciest|maximum\s+price)/i.test(rawLower)) {
    const sorted = [...currentCart.items].sort((a, b) => b.price - a.price);
    return { matchedItem: sorted[0], isAmbiguous: false, notFound: false };
  }

  // 2. Ordinal positions in current cart
  if (/(?:first|1st)(?:\s+(?:item|product|one))?/i.test(rawLower)) {
    return { matchedItem: currentCart.items[0], isAmbiguous: false, notFound: false };
  }
  if (/(?:second|2nd)(?:\s+(?:item|product|one))?/i.test(rawLower)) {
    if (currentCart.items.length >= 2) {
      return { matchedItem: currentCart.items[1], isAmbiguous: false, notFound: false };
    }
    return { notFound: true, isAmbiguous: false, reason: 'Cart does not have a second item' };
  }
  if (/(?:third|3rd)(?:\s+(?:item|product|one))?/i.test(rawLower)) {
    if (currentCart.items.length >= 3) {
      return { matchedItem: currentCart.items[2], isAmbiguous: false, notFound: false };
    }
    return { notFound: true, isAmbiguous: false, reason: 'Cart does not have a third item' };
  }
  if (/(?:last)(?:\s+(?:item|product|one))?/i.test(rawLower)) {
    return { matchedItem: currentCart.items[currentCart.items.length - 1], isAmbiguous: false, notFound: false };
  }

  // 3. Pronouns or unspecified/generic targets ("it", "that", "this", "the same one", "the product", "the item", "")
  const isPronounOrGeneric = !rawLower || /^(it|that|this|the\s+same(?:\s+one)?|the\s+product|the\s+item|item|product|them|cart|quantity)$/i.test(rawLower);
  if (isPronounOrGeneric) {
    // If conversation context clearly identifies a single recent product in the cart:
    if (lastActiveProduct) {
      const activeId = String(lastActiveProduct.id || lastActiveProduct.productid || '');
      const activeName = (lastActiveProduct.name || lastActiveProduct.title || '').toLowerCase();
      const activeInCart = currentCart.items.find(i => 
        (activeId && String(i.productId) === activeId) ||
        (activeName && i.name.toLowerCase().includes(activeName))
      );
      if (activeInCart) {
        return { matchedItem: activeInCart, isAmbiguous: false, notFound: false };
      }
    }
    // If cart contains exactly 1 product, it's unambiguous:
    if (currentCart.items.length === 1) {
      return { matchedItem: currentCart.items[0], isAmbiguous: false, notFound: false };
    }
    // If cart contains multiple products and no active product matches: AMBIGUOUS!
    return { isAmbiguous: true, ambiguousMatches: currentCart.items, notFound: false };
  }

  // 4. Keyword / Name matching against current cart items
  const cleanKeyword = rawLower
    .replace(/^(?:the|my|this|that|an?)\s+/i, '')
    .replace(/\s+(?:quantity|item|product|in\s+(?:my\s+)?cart|from\s+(?:my\s+)?cart)$/i, '')
    .trim();

  const singularKeyword = cleanKeyword.endsWith('s') && cleanKeyword.length > 3
    ? cleanKeyword.substring(0, cleanKeyword.length - 1)
    : cleanKeyword;

  const matchingItems = currentCart.items.filter(item => {
    const itemName = item.name.toLowerCase();
    const itemCat = (item.category || '').toLowerCase();
    return itemName.includes(cleanKeyword) ||
           cleanKeyword.includes(itemName) ||
           itemName.includes(singularKeyword) ||
           singularKeyword.includes(itemName) ||
           itemCat.includes(cleanKeyword) ||
           itemCat.includes(singularKeyword) ||
           (singularKeyword === 'hat' && itemName.includes('hat')) ||
           (singularKeyword === 'shoe' && (itemName.includes('shoe') || itemName.includes('shoes'))) ||
           (singularKeyword === 'jacket' && itemName.includes('jacket')) ||
           (singularKeyword === 'top' && (itemName.includes('top') || itemName.includes('shirt'))) ||
           (singularKeyword === 'shirt' && (itemName.includes('shirt') || itemName.includes('t-shirt') || itemName.includes('top')));
  });

  if (matchingItems.length === 1) {
    return { matchedItem: matchingItems[0], isAmbiguous: false, notFound: false };
  }

  if (matchingItems.length > 1) {
    // If there is an active product among matches, prioritize it
    if (lastActiveProduct) {
      const activeId = String(lastActiveProduct.id || lastActiveProduct.productid || '');
      const activeMatch = matchingItems.find(i => activeId && String(i.productId) === activeId);
      if (activeMatch) {
        return { matchedItem: activeMatch, isAmbiguous: false, notFound: false };
      }
    }
    return { isAmbiguous: true, ambiguousMatches: matchingItems, notFound: false };
  }

  return { isAmbiguous: false, notFound: true, reason: `No cart item matching "${targetText}"` };
}

function getProductPrice(p: any): number {
  if (!p) return 0;
  if (p.price && typeof p.price === 'object' && p.price.amount !== undefined) {
    return parseFloat(p.price.amount);
  }
  if (typeof p.price === 'number') return p.price;
  if (typeof p.price === 'string') return parseFloat(p.price);
  if (p.discount) return parseFloat(p.discount);
  return 0;
}

export interface ParsedAddClause {
  rawClause: string;
  quantity: number;
  isAnother: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  exactPrice: number | null;
  isSecondCheapest: boolean;
  isCheapest: boolean;
  isMostExpensive: boolean;
  isFirst: boolean;
  isSecond: boolean;
  isThird: boolean;
  isLast: boolean;
  keyword: string;
}

/**
 * Parses compound add-to-cart requests into independent product intent clauses.
 * Examples:
 * - "Add a hat and a jacket to my cart" -> ["a hat", "a jacket"]
 * - "Add a hat, jacket and shoes" -> ["a hat", "jacket", "shoes"]
 * - "Add two hats and one jacket" -> ["two hats", "one jacket"]
 * - "Add a jacket under ₹3000 and shoes under ₹2000" -> ["a jacket under ₹3000", "shoes under ₹2000"]
 * - "Add the cheapest jacket and the cheapest shoes" -> ["the cheapest jacket", "the cheapest shoes"]
 */
export function parseAddIntentClauses(rawMessage: string): ParsedAddClause[] {
  const body = rawMessage
    .replace(/^(?:please\s+|can\s+you\s+)?(?:add|put|place)\s+/i, '')
    .replace(/\s+(?:to|into)\s+(?:my\s+)?cart.*$/i, '')
    .trim();

  // Split on commas and natural conjunctions
  const commaSegments = body.split(/,\s*/);
  const rawClauses: string[] = [];

  for (const segment of commaSegments) {
    const trimmedSeg = segment.trim();
    if (!trimmedSeg) continue;
    const subSegments = trimmedSeg.split(/\s+(?:and|also|plus|along\s+with)\s+/i);
    for (const sub of subSegments) {
      const s = sub.trim();
      if (s) rawClauses.push(s);
    }
  }

  const clausesToProcess = rawClauses.length > 0 ? rawClauses : [body];

  return clausesToProcess.map(clause => {
    let working = clause.trim();
    let quantity = 1;
    let isAnother = false;
    let maxPrice: number | null = null;
    let minPrice: number | null = null;
    let exactPrice: number | null = null;

    // 1. Price constraints (Extract FIRST to avoid interpreting prices like ₹2499 as quantity)
    const underMatch = working.match(/(?:under|below|less\s+than|within|<|at\s+most)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (underMatch) {
      maxPrice = parseFloat(underMatch[1]);
      working = working.replace(underMatch[0], ' ');
    }

    const aboveMatch = working.match(/(?:above|over|more\s+than|>|at\s+least)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
    if (aboveMatch) {
      minPrice = parseFloat(aboveMatch[1]);
      working = working.replace(aboveMatch[0], ' ');
    }

    const exactMatch = working.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i) || working.match(/\b(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees|bucks)\b/i);
    if (exactMatch && maxPrice === null && minPrice === null) {
      exactPrice = parseFloat(exactMatch[1]);
      working = working.replace(exactMatch[0], ' ');
    }

    // 2. Relative / Ordinal Selectors
    const isSecondCheapest = /(?:second|2nd)\s+cheapest/i.test(working);
    const isCheapest = /(?:cheapest|lowest\s+price|least\s+expensive|minimum\s+price)/i.test(working);
    const isMostExpensive = /(?:most\s+expensive|highest\s+price|priciest|maximum\s+price)/i.test(working);
    const isFirst = /(?:first|1st)(?!\s+cheapest)/i.test(working);
    const isSecond = /(?:second|2nd)(?!\s+cheapest)/i.test(working);
    const isThird = /(?:third|3rd)(?!\s+cheapest)/i.test(working);
    const isLast = /\blast\b/i.test(working);

    working = working
      .replace(/(?:the\s+)?(?:cheapest|lowest\s+price|least\s+expensive|minimum\s+price|most\s+expensive|highest\s+price|priciest|maximum\s+price)/gi, ' ')
      .replace(/(?:the\s+)?(?:second|2nd|first|1st|third|3rd|last)(?:\s+(?:one|item|product))?/gi, ' ');

    // 3. Quantity Parsing
    if (/\banother\b/i.test(working) || /\bone\s+more\b/i.test(working)) {
      isAnother = true;
      quantity = 1;
      working = working.replace(/\banother\b/i, ' ').replace(/\bone\s+more\b/i, ' ');
    } else {
      const qtyPrefixMatch = working.match(/^(?:the\s+|a\s+|an\s+)?(?:a\s+pair\s+of\s+)?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+/i);
      if (qtyPrefixMatch) {
        const parsed = parseNaturalNumber(qtyPrefixMatch[1]);
        if (parsed !== null && parsed > 0 && parsed <= 50) {
          quantity = parsed;
          working = working.slice(qtyPrefixMatch[0].length).trim();
        }
      } else {
        const qtyInlineMatch = working.match(/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pairs?\s+of\s+)?(?:hats?|jackets?|shoes?|tops?|shirts?|items?|products?)\b/i);
        if (qtyInlineMatch) {
          const parsed = parseNaturalNumber(qtyInlineMatch[1]);
          if (parsed !== null && parsed > 0 && parsed <= 50) {
            quantity = parsed;
          }
        }
      }
    }

    // 4. Clean search keyword
    const keyword = working
      .replace(/^(?:the|a|an|my|this|that|pairs?\s+of)\s+/gi, '')
      .replace(/\s+(?:one|ones|item|items|product|products|in\s+(?:my\s+)?cart)$/gi, '')
      .replace(/[^\w\s'-]/g, ' ')
      .trim();

    return {
      rawClause: clause,
      quantity,
      isAnother,
      maxPrice,
      minPrice,
      exactPrice,
      isSecondCheapest,
      isCheapest,
      isMostExpensive,
      isFirst,
      isSecond,
      isThird,
      isLast,
      keyword,
    };
  });
}

/**
 * Resolves a single parsed add clause against the catalog and conversation context.
 */
export async function resolveSingleAddClause(
  clause: ParsedAddClause,
  adapter: RazorpayCommerceAdapter,
  contextProducts: any[]
): Promise<any | null> {
  let candidates: any[] = [];

  if (clause.keyword.length > 0) {
    const searchRes = await adapter.searchProducts(clause.keyword, 20);
    candidates = searchRes.products || [];

    if (candidates.length === 0 && contextProducts.length > 0) {
      const kw = clause.keyword.toLowerCase();
      candidates = contextProducts.filter((p: any) =>
        p.name.toLowerCase().includes(kw) ||
        (p.category && p.category.toLowerCase().includes(kw))
      );
    }

    if (candidates.length === 0) {
      const listRes = await adapter.listProducts({ page: 1, limit: 50 });
      const kw = clause.keyword.toLowerCase();
      const singularKw = kw.endsWith('s') && kw.length > 3 ? kw.slice(0, -1) : kw;
      candidates = listRes.products.filter((p: any) =>
        p.name.toLowerCase().includes(kw) ||
        p.name.toLowerCase().includes(singularKw) ||
        (p.category && p.category.toLowerCase().includes(kw)) ||
        (p.category && p.category.toLowerCase().includes(singularKw))
      );
    }
  } else {
    // If no keyword specified (e.g. "Add the cheapest one")
    if (contextProducts.length > 0) {
      candidates = [...contextProducts];
    } else {
      const listRes = await adapter.listProducts({ page: 1, limit: 20 });
      candidates = listRes.products || [];
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  // 1. Semantic relevance ranking and demographic alignment (only when explicit keyword provided)
  if (clause.keyword.length > 0) {
    const ranked = rankAndFilterProducts(candidates, clause.keyword);
    if (ranked.length > 0) {
      candidates = ranked;
    }
  }

  // 2. Apply Price Filters if specified
  if (clause.maxPrice !== null) {
    candidates = candidates.filter(p => getProductPrice(p) <= clause.maxPrice!);
  }
  if (clause.minPrice !== null) {
    candidates = candidates.filter(p => getProductPrice(p) >= clause.minPrice!);
  }

  if (candidates.length === 0) {
    return null;
  }

  // Exact price match
  if (clause.exactPrice !== null) {
    const targetPrice = clause.exactPrice;
    const priceMatched = candidates.find(p => Math.abs(getProductPrice(p) - targetPrice) < 1);
    if (priceMatched) return priceMatched;
  }

  // Relative price selectors
  if (clause.isSecondCheapest) {
    const sortedAsc = [...candidates].sort((a, b) => getProductPrice(a) - getProductPrice(b));
    return sortedAsc.length > 1 ? sortedAsc[1] : sortedAsc[0];
  }
  if (clause.isCheapest) {
    const sortedAsc = [...candidates].sort((a, b) => getProductPrice(a) - getProductPrice(b));
    return sortedAsc[0];
  }
  if (clause.isMostExpensive) {
    const sortedDesc = [...candidates].sort((a, b) => getProductPrice(b) - getProductPrice(a));
    return sortedDesc[0];
  }

  // Ordinal selectors
  if (clause.isFirst) {
    return candidates[0];
  }
  if (clause.isSecond) {
    return candidates.length > 1 ? candidates[1] : candidates[0];
  }
  if (clause.isThird) {
    return candidates.length > 2 ? candidates[2] : candidates[candidates.length - 1];
  }
  if (clause.isLast) {
    return candidates[candidates.length - 1];
  }

  return candidates[0];
}

/**
 * Helper: Extract authenticated user ID from Bearer token or x-user-token
 */
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

/**
 * POST /api/ai/chat
 * 
 * Handles natural shopping requests & real cart operations (Add, Remove, Update Quantity, View Cart)
 */
router.post('/chat', async (req: Request, res: Response) => {
  const { message, userId, conversationId } = req.body;

  // 1. Validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      error: 'Message is required and must be a non-empty string.',
    });
  }

  const cleanMessage = message.trim();
  const authUserId = extractAuthenticatedUserID(req);
  const isAuthUser = Boolean(authUserId || (userId && typeof userId === 'number' && userId > 0));
  const targetUserId = authUserId || (typeof userId === 'number' ? userId : parseInt(userId, 10)) || DEFAULT_DEMO_USER_ID;

  try {
    // 2. Instantiate RazorpayCommerceAdapter & fetch current cart
    const adapter = new RazorpayCommerceAdapter({
      domain: 'localhost:3000',
      merchantName: 'Razorpay AI Commerce',
      defaultCurrency: 'INR',
    });

    let currentCart: RealCartState = await adapter.getCart(targetUserId);
    const session = getSession(conversationId, targetUserId);
    const lastActiveProduct = session?.lastActiveProduct;
    let finalAnswer = '';
    const collectedProducts: any[] = [];
    const seenProductIds = new Set<string>();

    // 3. Define Shopi Cart Plugins for ShoppingAgent
    const plugins: AgentPlugin[] = [
      {
        name: 'update_cart_quantity',
        description: 'Update the quantity of a product in the user\'s real shopping cart. Specify productId and new quantity.',
        parameters: {
          type: 'object',
          properties: {
            productId: { type: 'string', description: 'Product ID to update' },
            quantity: { type: 'integer', description: 'New quantity (e.g. 1 to 10)' },
          },
          required: ['productId', 'quantity'],
        },
        handler: async (args: Record<string, unknown>) => {
          const prodId = args.productId as string;
          const qty = args.quantity as number;
          const res = await adapter.updateCartQuantity(targetUserId, prodId, qty);
          currentCart = res.cart;
          return res;
        },
      },
    ];

    const lower = cleanMessage.toLowerCase();

    // ──────────────────────────────────────────────────────────────────────────
    // 4. NATURAL INTENT RESOLUTION
    // ──────────────────────────────────────────────────────────────────────────

    // 0. Checkout Intent:
    // "checkout", "take me to checkout", "i want to checkout", "buy this", "buy everything in my cart",
    // "i'm ready to buy", "proceed to checkout", "let me pay", "place my order", "go to checkout", "ready to checkout", "pay now", "proceed"
    const isCheckoutIntent = 
      /^(?:please\s+)?(?:proceed\s+to\s+)?checkout\b/i.test(lower) ||
      /^(?:take|bring|direct|lead)\s+me\s+to\s+checkout\b/i.test(lower) ||
      /^(?:i\s+(?:want|would\s+like|need)\s+to\s+)?checkout\b/i.test(lower) ||
      /^(?:i'?m\s+)?ready\s+to\s+(?:buy|checkout|pay)\b/i.test(lower) ||
      /^(?:buy|purchase)\s+(?:this|everything|all(?:\s+items?)?)(?:\s+in\s+my\s+cart)?$/i.test(lower) ||
      /^(?:proceed\s+to\s+checkout|proceed\s+to\s+payment|go\s+to\s+checkout|let\s+me\s+pay|place\s+(?:my\s+)?order|pay\s+now|proceed)$/i.test(lower);

    if (isCheckoutIntent) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'checkout',
          message: 'Your cart is currently empty. Add something before checking out.',
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
        .map((i: RealCartItem) => `• ${i.name} ×${i.quantity} — ₹${i.price.toLocaleString('en-IN')}`)
        .join('\n');

      const checkoutMessage = `You're ready to checkout! 🛒\n\nYour cart:\n${itemLines}\n\nTotal: ₹${currentCart.total.toLocaleString('en-IN')} INR`;

      return res.status(200).json({
        success: true,
        intent: 'checkout',
        message: checkoutMessage,
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

    // Address Intent 1: "Show my saved addresses", "Show my addresses", "What address do you have?", "List my addresses"
    const isShowAddressIntent = 
      /^(?:show|view|list|get|display)\s+(?:my\s+)?(?:saved\s+)?addresses\b/i.test(lower) ||
      /^(?:what|which)\s+address(?:es)?\s+(?:do\s+you\s+have|are\s+saved)/i.test(lower) ||
      /^(?:my\s+saved\s+addresses|my\s+addresses)$/i.test(lower);

    if (isShowAddressIntent) {
      if (!isAuthUser) {
        return res.status(200).json({
          success: true,
          intent: 'address_list',
          message: 'Please sign in to view your saved delivery addresses, or proceed to checkout to enter an address.',
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const addresses = await adapter.getUserAddresses(targetUserId);
      if (addresses.length === 0) {
        return res.status(200).json({
          success: true,
          intent: 'address_list',
          message: "You don't have any saved delivery addresses yet. Please enter your delivery address on the checkout page, and I'll use it for your order.",
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const formattedAddresses = addresses.map((addr, idx) => {
        const defaultBadge = addr.is_default ? '\n   ⭐ Default shipping address' : '';
        const line2 = addr.addressLine2 ? `, ${addr.addressLine2}` : '';
        return `${idx + 1}. ${addr.userName}\n   ${addr.addressLine1}${line2}\n   ${addr.city}, ${addr.state} - ${addr.postalCode}${defaultBadge}`;
      }).join('\n\n');

      const message = `Here are your saved delivery addresses:\n\n${formattedAddresses}`;

      return res.status(200).json({
        success: true,
        intent: 'address_list',
        message,
        addresses,
        products: [],
        cart: currentCart,
        checkout: { available: true, url: '/cart-checkout' },
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // Address Intent 2: "Use my default address", "Use my saved address", "Deliver to my saved address", "Use default address", "Deliver to my default address"
    const isUseDefaultAddressIntent = 
      /^(?:use|deliver\s+to|ship\s+to|select)\s+(?:my\s+)?(?:saved|default)\s+address\b/i.test(lower) ||
      /^(?:use|deliver\s+to|ship\s+to|select)\s+default\s+address\b/i.test(lower) ||
      /^(?:use\s+this\s+address)$/i.test(lower);

    if (isUseDefaultAddressIntent) {
      if (!isAuthUser) {
        return res.status(200).json({
          success: true,
          intent: 'address_selected',
          message: 'Please sign in to use your saved delivery address, or proceed to checkout to enter your address.',
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const defaultAddr = await adapter.getDefaultAddress(targetUserId);
      if (!defaultAddr) {
        return res.status(200).json({
          success: true,
          intent: 'address_selected',
          message: "You don't have a default address saved yet. Please enter your delivery address on the checkout page.",
          products: [],
          cart: currentCart,
          checkout: { available: true, url: '/cart-checkout' },
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const line2 = defaultAddr.addressLine2 ? `, ${defaultAddr.addressLine2}` : '';
      const message = `I'll use your default delivery address for your order:\n\n📍 ${defaultAddr.userName}\n${defaultAddr.addressLine1}${line2}\n${defaultAddr.city}, ${defaultAddr.state} - ${defaultAddr.postalCode}\n\nReady to proceed to checkout!`;

      return res.status(200).json({
        success: true,
        intent: 'address_selected',
        message,
        selectedAddress: defaultAddr,
        products: [],
        cart: currentCart,
        checkout: { available: true, url: '/cart-checkout' },
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // Address Intent 3: "Add a new address", "I want to use another address", "Change my delivery address", "Update my address"
    const isNewOrChangeAddressIntent = 
      /^(?:add|insert|enter)\s+(?:a\s+)?new\s+address\b/i.test(lower) ||
      /^(?:i\s+want\s+to\s+use\s+another\s+address|use\s+another\s+address)\b/i.test(lower) ||
      /^(?:change|update|edit)\s+(?:my\s+)?(?:delivery\s+)?address\b/i.test(lower);

    if (isNewOrChangeAddressIntent) {
      return res.status(200).json({
        success: true,
        intent: 'address_new',
        message: "Sure! Please enter your delivery address on the checkout page, and I'll use it for your order.",
        products: [],
        cart: currentCart,
        checkout: { available: true, url: '/cart-checkout' },
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // A. View Cart Intent: "What's in my cart?" / "View cart" / "Show cart"
    if (/^(what('?s| is) in my cart|view (my )?cart|show (my )?cart|how much is my cart|cart summary)/i.test(lower)) {
      currentCart = await adapter.getCart(targetUserId);
      if (currentCart.items.length === 0) {
        finalAnswer = 'Your shopping cart is currently empty.';
      } else {
        const itemSummaries = currentCart.items.map((i: RealCartItem) => `${i.name} (Qty: ${i.quantity}, ₹${i.price})`).join(', ');
        finalAnswer = `Your cart has ${currentCart.itemCount} item(s) (${itemSummaries}) with a total of ₹${currentCart.total} INR.`;
      }
      return res.status(200).json({
        success: true,
        message: finalAnswer,
        products: [],
        cart: currentCart,
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // B. Incremental / Additive Quantity Intent: "Add another hat" / "Add two more hats" / "Add 1 more"
    const addMoreMatch = lower.match(/add\s+(\d+|one|two|three|four|five|1|2|3|4|5)\s+more(?:\s+([\w\s'-]+))?/i);
    const addAnotherMatch = lower.match(/add\s+another(?:\s+([\w\s'-]+))?/i) || lower.match(/add\s+one\s+more(?:\s+([\w\s'-]+))?/i);

    if (addMoreMatch || addAnotherMatch) {
      currentCart = await adapter.getCart(targetUserId);
      let delta = 1;
      let targetText = '';

      if (addMoreMatch) {
        delta = parseNaturalNumber(addMoreMatch[1]) || 1;
        targetText = (addMoreMatch[2] || '').trim();
      } else if (addAnotherMatch) {
        delta = 1;
        targetText = (addAnotherMatch[1] || '').trim();
      }

      if (targetText === 'one' || targetText === 'item' || targetText === 'product') {
        targetText = '';
      }

      const resolution = resolveTargetCartItem(targetText, currentCart, lastActiveProduct);

      if (resolution.isAmbiguous) {
        return res.status(200).json({
          success: true,
          message: `Which product would you like to add more of?\n\nYour cart contains:\n${formatCartItemList(resolution.ambiguousMatches || currentCart.items)}`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      if (resolution.matchedItem) {
        const item = resolution.matchedItem;
        const newQty = item.quantity + delta;
        const upRes = await adapter.updateCartQuantity(targetUserId, item.productId, newQty);
        currentCart = upRes.cart;
        updateSession(conversationId, targetUserId, {
          lastActiveProduct: { id: item.productId, name: item.name },
        });

        return res.status(200).json({
          success: true,
          message: `I've increased the quantity of "${item.name}" to ${newQty} in your cart.`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }
    }

    // C. Explicit & Relative Quantity Updates:
    // "Change the hat quantity to 3", "Make the jacket quantity 2", "Change quantity to 2", "Make it 5", "Actually make it 3", "I want 3 hats"
    const isQtyCommand = 
      /(?:change|update|set|make)\s+(?:the\s+)?quantity(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(lower) ||
      /(?:change|update|set|make)(?:\s+the)?\s+(.+?)\s+quantity(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(lower) ||
      /(?:change|update|set|make)(?:\s+the)?\s+quantity(?:\s+of(?:\s+the)?)?\s+(.+?)(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(lower) ||
      /(?:actually\s+)?(?:change|update|set|make)(?:\s+the)?\s+(.+?)(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i.test(lower) ||
      /(?:i\s+want|give\s+me)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+([\w\s'-]+)/i.test(lower);

    if (isQtyCommand && !lower.startsWith('find') && !lower.startsWith('show') && !lower.startsWith('search')) {
      currentCart = await adapter.getCart(targetUserId);

      let targetText = '';
      let targetQty: number | null = null;

      // Match 1: "Change the quantity to [N]"
      const genericQtyMatch = lower.match(/(?:change|update|set|make)\s+(?:the\s+)?quantity(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
      if (genericQtyMatch) {
        targetText = '';
        targetQty = parseNaturalNumber(genericQtyMatch[1]);
      }

      // Match 2: "Change the [item] quantity to [N]"
      if (targetQty === null) {
        const itemQtyMatch = lower.match(/(?:change|update|set|make)(?:\s+the)?\s+(.+?)\s+quantity(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
        if (itemQtyMatch) {
          targetText = (itemQtyMatch[1] || '').trim();
          targetQty = parseNaturalNumber(itemQtyMatch[2]);
        }
      }

      // Match 3: "Change the quantity of [item] to [N]"
      if (targetQty === null) {
        const itemQtyOfMatch = lower.match(/(?:change|update|set|make)(?:\s+the)?\s+quantity(?:\s+of(?:\s+the)?)?\s+(.+?)(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
        if (itemQtyOfMatch) {
          targetText = (itemQtyOfMatch[1] || '').trim();
          targetQty = parseNaturalNumber(itemQtyOfMatch[2]);
        }
      }

      // Match 4: "Make it [N]" / "Actually make it [N]" / "Change [item] to [N]"
      if (targetQty === null) {
        const makeItMatch = lower.match(/(?:actually\s+)?(?:change|update|set|make)(?:\s+the)?\s+(.+?)(?:\s+to)?\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
        if (makeItMatch) {
          targetText = (makeItMatch[1] || '').trim();
          targetQty = parseNaturalNumber(makeItMatch[2]);
        }
      }

      // Match 5: "I want 3 hats"
      if (targetQty === null) {
        const wantMatch = lower.match(/(?:i\s+want|give\s+me)\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+([\w\s'-]+)/i);
        if (wantMatch) {
          targetQty = parseNaturalNumber(wantMatch[1]);
          targetText = (wantMatch[2] || '').trim();
        }
      }

      if (targetQty !== null && targetQty >= 0) {
        const resolution = resolveTargetCartItem(targetText, currentCart, lastActiveProduct);

        // DISAMBIGUATION / CLARIFICATION REQUIRED:
        if (resolution.isAmbiguous) {
          return res.status(200).json({
            success: true,
            message: `Which product would you like to change to quantity ${targetQty}?\n\nYour cart contains:\n${formatCartItemList(resolution.ambiguousMatches || currentCart.items)}`,
            products: [],
            cart: currentCart,
            userId: targetUserId,
            conversationId: conversationId || undefined,
          });
        }

        if (resolution.matchedItem) {
          const item = resolution.matchedItem;
          if (targetQty === 0) {
            const remRes = await adapter.removeFromCart(targetUserId, item.productId);
            currentCart = remRes.cart;
            updateSession(conversationId, targetUserId, { lastActiveProduct: undefined });
            return res.status(200).json({
              success: true,
              message: `I've removed "${item.name}" from your cart.`,
              products: [],
              cart: currentCart,
              userId: targetUserId,
              conversationId: conversationId || undefined,
            });
          } else {
            const upRes = await adapter.updateCartQuantity(targetUserId, item.productId, targetQty);
            currentCart = upRes.cart;
            updateSession(conversationId, targetUserId, {
              lastActiveProduct: { id: item.productId, name: item.name },
            });
            return res.status(200).json({
              success: true,
              message: `I've updated the quantity of "${item.name}" to ${targetQty} in your cart.`,
              products: [],
              cart: currentCart,
              userId: targetUserId,
              conversationId: conversationId || undefined,
            });
          }
        }
      }
    }

    // D. Safe Remove Intent: "Remove the hat" / "Remove the jacket" / "Remove the cheapest item" / "Remove the first item"
    const isRemoveIntent = /^remove\s+/i.test(lower) || /^(?:please\s+)?delete\s+/i.test(lower) || /remove\s+.+\s+(?:from\s+(?:my\s+)?cart)/i.test(lower);
    if (isRemoveIntent) {
      currentCart = await adapter.getCart(targetUserId);

      if (currentCart.items.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'Your shopping cart is currently empty.',
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      const removeTarget = lower
        .replace(/^(?:please\s+)?(?:remove|delete)\s+(?:the\s+)?/i, '')
        .replace(/\s+from\s+(?:my\s+)?cart.*$/i, '')
        .trim();

      const resolution = resolveTargetCartItem(removeTarget, currentCart, lastActiveProduct);

      if (resolution.isAmbiguous) {
        return res.status(200).json({
          success: true,
          message: `Which product would you like me to remove?\n\nYour cart contains:\n${formatCartItemList(resolution.ambiguousMatches || currentCart.items)}`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      if (resolution.matchedItem) {
        const item = resolution.matchedItem;
        const remRes = await adapter.removeFromCart(targetUserId, item.productId);
        currentCart = remRes.cart;
        updateSession(conversationId, targetUserId, { lastActiveProduct: undefined });

        return res.status(200).json({
          success: true,
          message: `I've removed "${item.name}" from your cart.`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }
    }

    // E. Add to Cart Intent: Multi-Product & Single-Product Natural-Language Resolution
    // Supports compound requests (e.g. "Add a hat and a jacket", "Add a hat, jacket and shoes", "Add two hats and one jacket",
    // "Add the cheapest jacket and cheapest shoes", "Add a jacket under ₹3000 and shoes under ₹2000")
    const isAddIntent = /add\s+.+\s+(?:to\s+(?:my\s+)?cart|into\s+(?:my\s+)?cart)/i.test(lower) || /^add\s+/i.test(lower);
    if (isAddIntent) {
      const contextProducts = session?.lastProducts || [];
      const clauses = parseAddIntentClauses(cleanMessage);

      interface ResolvedItem {
        clause: ParsedAddClause;
        product: any;
        price: number;
        quantity: number;
      }

      const resolvedItems: ResolvedItem[] = [];
      const notFoundClauses: ParsedAddClause[] = [];

      for (const clause of clauses) {
        const matched = await resolveSingleAddClause(clause, adapter, contextProducts);
        if (matched) {
          resolvedItems.push({
            clause,
            product: matched,
            price: getProductPrice(matched),
            quantity: Math.max(1, clause.quantity || 1),
          });
        } else {
          notFoundClauses.push(clause);
        }
      }

      // If nothing was resolved
      if (resolvedItems.length === 0) {
        const failedNames = notFoundClauses.map(c => `"${c.keyword || c.rawClause}"`).join(', ');
        return res.status(200).json({
          success: true,
          message: `I couldn't find any products matching ${failedNames} in our store catalog.`,
          products: [],
          cart: currentCart,
          userId: targetUserId,
          conversationId: conversationId || undefined,
        });
      }

      // Execute Cart Mutations for each resolved product in PostgreSQL
      for (const item of resolvedItems) {
        const addRes = await adapter.addToCart(targetUserId, item.product.id, item.quantity);
        currentCart = addRes.cart;
      }

      // Update session with the last active product
      const lastActive = resolvedItems[resolvedItems.length - 1].product;
      updateSession(conversationId, targetUserId, {
        lastActiveProduct: lastActive,
      });

      // Construct formatted response message
      let messageText = '';
      if (resolvedItems.length === 1 && notFoundClauses.length === 0) {
        const item = resolvedItems[0];
        messageText = `I've added "${item.product.name}" (Qty: ${item.quantity}, ₹${item.price.toFixed(2)}) to your cart.`;
      } else if (resolvedItems.length > 1 && notFoundClauses.length === 0) {
        const bulletList = resolvedItems
          .map(i => `• ${i.product.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
          .join('\n');
        messageText = `Done! I've added the following items to your cart:\n${bulletList}\n\nYour cart now has ${currentCart.itemCount} item(s) with a total of ₹${currentCart.total.toLocaleString('en-IN')} INR.`;
      } else {
        // Some items resolved, some not found
        const addedList = resolvedItems
          .map(i => `• ${i.product.name} ×${i.quantity} — ₹${(i.price * i.quantity).toLocaleString('en-IN')}`)
          .join('\n');
        const failedNames = notFoundClauses.map(c => `"${c.keyword || c.rawClause}"`).join(', ');
        messageText = `I've added:\n${addedList}\n\nHowever, I couldn't find a product matching ${failedNames}. I haven't added the unavailable item(s).\n\nYour cart now has ${currentCart.itemCount} item(s) with a total of ₹${currentCart.total.toLocaleString('en-IN')} INR.`;
      }

      const responseProducts = resolvedItems.map(item => ({
        id: item.product.id,
        name: item.product.name,
        price: item.price,
        currency: item.product.price?.currency || 'INR',
        imageUrl: item.product.imageUrl,
        category: item.product.category,
        inStock: item.product.inStock ?? true,
      }));

      return res.status(200).json({
        success: true,
        message: messageText,
        products: responseProducts,
        cart: currentCart,
        userId: targetUserId,
        conversationId: conversationId || undefined,
      });
    }

    // 5. Groq LLM + Shopi ShoppingAgent Orchestration (General & Discovery Queries)
    const groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
    const groqKey = process.env.GROQ_API_KEY || '';

    if (groqKey && groqKey.trim().length > 0) {
      try {
        const groqAdapter = new GroqAdapter({
          apiKey: groqKey,
          model: groqModel,
        });

        const agent = new ShoppingAgent({
          llm: groqAdapter,
          adapters: [adapter],
          plugins,
          maxIterations: 8,
          verbose: false,
        });

        const taskPrompt = `You are Shopi AI, an intelligent shopping assistant for Razorpay AI Commerce. User query: "${cleanMessage}". First search or inspect localhost:3000 catalog. Present real products with prices in INR.`;
        const agentRes = await agent.run(taskPrompt);
        finalAnswer = agentRes.answer || '';

        // Collect products from tool execution steps
        if (agentRes.steps && Array.isArray(agentRes.steps)) {
          for (const step of agentRes.steps) {
            if (step.type === 'tool_result' && step.toolOutput) {
              const output = step.toolOutput as any;
              if (output.products && Array.isArray(output.products)) {
                for (const p of output.products) {
                  if (!seenProductIds.has(p.id)) {
                    seenProductIds.add(p.id);
                    collectedProducts.push({
                      id: p.id,
                      name: p.name,
                      price: parseFloat(p.price?.amount || p.price || 0),
                      currency: p.price?.currency || 'INR',
                      imageUrl: p.imageUrl,
                      category: p.category,
                      inStock: p.inStock ?? true,
                    });
                  }
                }
              }
            }
          }
        }
      } catch (agentErr: any) {
        console.warn('[AI Agent Notice]:', agentErr.message);
      }
    }

    // 6. Direct Catalog Search for Discovery Queries
    if (collectedProducts.length === 0) {
      const searchRes = await adapter.searchProducts(cleanMessage, 5);
      for (const p of searchRes.products) {
        if (!seenProductIds.has(p.id)) {
          seenProductIds.add(p.id);
          collectedProducts.push({
            id: p.id,
            name: p.name,
            price: parseFloat(p.price.amount),
            currency: p.price.currency,
            imageUrl: p.imageUrl,
            category: p.category,
            inStock: p.inStock ?? true,
          });
        }
      }
    }

    // Apply semantic ranking to ensure highest relevance products are first
    const rankedCollected = rankAndFilterProducts(collectedProducts, cleanMessage);
    const finalDisplayProducts = rankedCollected.length > 0 ? rankedCollected : collectedProducts;

    if (!finalAnswer || finalAnswer.trim().length === 0) {
      if (finalDisplayProducts.length > 0) {
        finalAnswer = `I found ${finalDisplayProducts.length} product(s) matching "${cleanMessage}" in our store catalog:`;
      } else {
        finalAnswer = `I could not find any products matching "${cleanMessage}" in our catalog.`;
      }
    }

    // Save active products in conversation context session memory
    updateSession(conversationId, targetUserId, {
      lastProducts: finalDisplayProducts,
      lastQuery: cleanMessage,
      lastActiveProduct: finalDisplayProducts.length === 1 ? finalDisplayProducts[0] : undefined,
    });

    // Always fetch latest cart state for the user
    currentCart = await adapter.getCart(targetUserId);

    return res.status(200).json({
      success: true,
      message: finalAnswer,
      products: finalDisplayProducts,
      cart: currentCart,
      model: groqModel,
      userId: targetUserId,
      conversationId: conversationId || undefined,
      stepsCount: finalDisplayProducts.length,
    });
  } catch (error: any) {
    console.error('[AI Shopping Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'An error occurred while processing your AI shopping request.',
    });
  }
});

export default router;
