/**
 * ⚡ ConversationalResolver.ts
 * 
 * Intelligent intent classification and entity/reference resolution for Shopi AI.
 * Resolves pronoun references ("that", "them"), collection references ("all the results", "both"),
 * ordinal selectors ("first one", "second one"), and price comparisons against the active conversation state.
 */

import { CanonicalProduct, ConversationState, ConversationFilters } from './ConversationalStateManager';
import { RealCartState, RealCartItem } from './RazorpayCommerceAdapter';

export type ShopiIntentType =
  | 'ADD_TO_CART_ALL'
  | 'ADD_TO_CART_SINGLE'
  | 'ADD_TO_CART_COMPOUND'
  | 'VIEW_PRODUCT'
  | 'REMOVE_FROM_CART'
  | 'UPDATE_QUANTITY'
  | 'COMPARE_RECOMMENDATIONS'
  | 'REFINE_SEARCH'
  | 'CHECK_LAST_ADDED'
  | 'CHECK_CART'
  | 'CLEAR_CART'
  | 'CHECKOUT'
  | 'ADDRESS_LIST'
  | 'ADDRESS_DEFAULT'
  | 'ADDRESS_NEW'
  | 'NEW_SEARCH';

export interface ClassifiedIntent {
  type: ShopiIntentType;
  rawMessage: string;
  referenceType?: 'LAST_RECOMMENDATION_SET' | 'ORDINAL' | 'EXTREMUM' | 'LAST_MENTIONED' | 'VIEWED_PRODUCT' | 'CART_ITEM' | 'NONE';
  targetOrdinal?: number; // 0-indexed (0 = first, 1 = second, etc.)
  targetExtremum?: 'cheapest' | 'expensive' | 'second_cheapest';
  targetKeyword?: string;
  targetQuantity?: number;
  extractedPrice?: { min?: number; max?: number; exact?: number };
  extractedColor?: string;
  confidence: number;
}

export interface ResolvedEntities {
  resolvedProducts: CanonicalProduct[];
  targetCartItem?: RealCartItem;
  inheritedFilters?: ConversationFilters;
  isAmbiguous: boolean;
  ambiguousCartItems?: RealCartItem[];
  notFoundReason?: string;
  isReferenceResolved: boolean;
}

/**
 * 1. CLASSIFY USER INTENT DETERMINISTICALLY
 */
export function classifyIntent(message: string, state: ConversationState): ClassifiedIntent {
  const raw = message.trim();
  const lower = raw.toLowerCase();

  // A. Checkout Intent
  if (
    /^(?:please\s+)?(?:proceed\s+to\s+)?checkout\b/i.test(lower) ||
    /^(?:take|bring|direct|lead)\s+me\s+to\s+checkout\b/i.test(lower) ||
    /^(?:i\s+(?:want|would\s+like|need)\s+to\s+)?checkout\b/i.test(lower) ||
    /^(?:i'?m\s+)?ready\s+to\s+(?:buy|checkout|pay)\b/i.test(lower) ||
    /^(?:buy|purchase)\s+(?:this|everything|all(?:\s+items?)?)(?:\s+in\s+my\s+cart)?$/i.test(lower) ||
    /^(?:proceed\s+to\s+checkout|proceed\s+to\s+payment|go\s+to\s+checkout|let\s+me\s+pay|place\s+(?:my\s+)?order|pay\s+now|proceed)$/i.test(lower)
  ) {
    return { type: 'CHECKOUT', rawMessage: raw, confidence: 1.0 };
  }

  // B. Address Intents
  if (/^(?:show|view|list|get|display)\s+(?:my\s+)?(?:saved\s+)?addresses\b/i.test(lower) || /^(?:my\s+saved\s+addresses|my\s+addresses)$/i.test(lower)) {
    return { type: 'ADDRESS_LIST', rawMessage: raw, confidence: 1.0 };
  }
  if (/^(?:use|deliver\s+to|ship\s+to|select)\s+(?:my\s+)?(?:saved|default)\s+address\b/i.test(lower) || /^(?:use\s+default\s+address|use\s+this\s+address)$/i.test(lower)) {
    return { type: 'ADDRESS_DEFAULT', rawMessage: raw, confidence: 1.0 };
  }
  if (/^(?:add|insert|enter)\s+(?:a\s+)?new\s+address\b/i.test(lower) || /^(?:change|update|edit)\s+(?:my\s+)?(?:delivery\s+)?address\b/i.test(lower)) {
    return { type: 'ADDRESS_NEW', rawMessage: raw, confidence: 1.0 };
  }

  // C. Query What Was Just Added
  if (
    /^(what\s+(?:did\s+i|have\s+i)\s+(?:just\s+)?add(?:ed)?(?:\s+to\s+cart)?|what\s+was\s+added|show\s+(?:me\s+)?what\s+i\s+just\s+added)/i.test(lower)
  ) {
    return { type: 'CHECK_LAST_ADDED', rawMessage: raw, referenceType: 'LAST_MENTIONED', confidence: 1.0 };
  }

  // D. View Cart / Cart Total
  if (
    /^(what('?s| is) in my cart|view (my )?cart|show (my )?cart|how much is my cart|cart summary|how many (items |products )?are in my cart|what is my total|check my cart)/i.test(lower)
  ) {
    return { type: 'CHECK_CART', rawMessage: raw, confidence: 1.0 };
  }

  // E. Clear Cart
  if (/^(?:clear|empty|delete|remove\s+all)\s+(?:the\s+|my\s+)?cart/i.test(lower)) {
    return { type: 'CLEAR_CART', rawMessage: raw, confidence: 1.0 };
  }

  // F. View / Navigate Product (e.g. "show me the second one", "open the first product", "view the second one")
  const viewOrdinalMatch = lower.match(/^(?:show|open|view|tell\s+me\s+about|display)\s+(?:me\s+)?(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|last)\s+(?:one|product|item|result)/i);
  if (viewOrdinalMatch) {
    const word = viewOrdinalMatch[1].toLowerCase();
    const ordMap: Record<string, number> = { 'first': 0, '1st': 0, 'second': 1, '2nd': 1, 'third': 2, '3rd': 2, 'fourth': 3, '4th': 3, 'last': -1 };
    return {
      type: 'VIEW_PRODUCT',
      rawMessage: raw,
      referenceType: 'ORDINAL',
      targetOrdinal: ordMap[word] !== undefined ? ordMap[word] : 0,
      confidence: 0.95,
    };
  }

  // G. Comparison Queries against previous recommendations (e.g. "which one is cheapest?", "which one is most expensive?", "compare those two", "which has better rating?")
  if (
    state.lastRecommendedProducts &&
    state.lastRecommendedProducts.length > 0 &&
    (
      /^(?:which|what)\s+(?:one|product|item)\s+is\s+(?:the\s+)?(?:cheapest|cheaper|lowest\s+price|least\s+expensive)/i.test(lower) ||
      /^(?:which|what)\s+(?:one|product|item)\s+is\s+(?:the\s+)?(?:most\s+expensive|highest\s+price|priciest)/i.test(lower) ||
      /^(?:which|what)\s+(?:one|product|item)\s+is\s+(?:the\s+)?(?:best|top\s+rated|highest\s+rating)/i.test(lower) ||
      /^(?:compare|diff)\s+(?:those|them|the\s+products|these|the\s+two|both)/i.test(lower) ||
      /^(?:which\s+one\s+should\s+i\s+buy|which\s+is\s+better)/i.test(lower)
    )
  ) {
    let extremum: 'cheapest' | 'expensive' | undefined;
    if (/(?:cheapest|cheaper|lowest\s+price|least\s+expensive)/i.test(lower)) extremum = 'cheapest';
    if (/(?:most\s+expensive|highest\s+price|priciest)/i.test(lower)) extremum = 'expensive';

    return {
      type: 'COMPARE_RECOMMENDATIONS',
      rawMessage: raw,
      referenceType: 'LAST_RECOMMENDATION_SET',
      targetExtremum: extremum,
      confidence: 0.95,
    };
  }

  // H. Remove Intent (e.g. "remove the jacket", "remove the second one", "remove that", "delete the first item")
  if (/^(?:remove|delete)\s+/i.test(lower) || /remove\s+.+\s+from\s+(?:my\s+)?cart/i.test(lower)) {
    const targetText = lower
      .replace(/^(?:please\s+)?(?:remove|delete)\s+(?:the\s+)?/i, '')
      .replace(/\s+from\s+(?:my\s+)?cart.*$/i, '')
      .trim();

    const ordinalMatch = targetText.match(/^(first|1st|second|2nd|third|3rd|last)(?:\s+(?:one|item|product))?$/i);
    const ordMap: Record<string, number> = { 'first': 0, '1st': 0, 'second': 1, '2nd': 1, 'third': 2, '3rd': 2, 'last': -1 };

    return {
      type: 'REMOVE_FROM_CART',
      rawMessage: raw,
      referenceType: ordinalMatch ? 'ORDINAL' : (targetText === 'that' || targetText === 'it' ? 'LAST_MENTIONED' : 'CART_ITEM'),
      targetOrdinal: ordinalMatch ? ordMap[ordinalMatch[1].toLowerCase()] : undefined,
      targetKeyword: targetText,
      confidence: 0.95,
    };
  }

  // I. Add To Cart - Collection / Multi-Product References
  const isCollectionAdd =
    /^(?:please\s+|can\s+you\s+)?(?:add|put|place|buy)\s+(?:all\s+the\s+results|all\s+results|all\s+of\s+them|all\s+those(?:\s+products)?|all|everything(?:\s+(?:that\s+|which\s+)?you\s+(?:just(?:\s+now)?\s+)?(?:showed|recommended)\s+me)?|(?:the\s+)?products\s+(?:which\s+|that\s+)?you\s+(?:just(?:\s+now)?\s+)?(?:showed|show|recommended|recommend)\s+(?:to\s+)?me|those\s+products|those\s+items|both(?:\s+of\s+them)?|both\s+products)(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?$/i.test(lower) ||
    /^(?:add|put|place)\s+(?:all|both|everything)(?:\s+(?:of\s+)?(?:them|the\s+results|those))?(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?$/i.test(lower) ||
    /^(?:put|add)\s+them\s+(?:all\s+)?(?:in|to|into)\s+(?:my\s+)?cart$/i.test(lower) ||
    /^(?:buy|add)\s+(?:those|them|both)$/i.test(lower) ||
    /add\s+(?:all\s+)?(?:the\s+)?(?:products|results|items)\s+(?:that\s+|which\s+)?you\s+(?:just(?:\s+now)?\s+)?(?:showed|show|recommended|recommend)\s+(?:to\s+)?me(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?/i.test(lower);

  if (isCollectionAdd) {
    return {
      type: 'ADD_TO_CART_ALL',
      rawMessage: raw,
      referenceType: 'LAST_RECOMMENDATION_SET',
      confidence: 0.99,
    };
  }

  // J. Add To Cart - Single Ordinal or Extremum or Pronoun Reference
  // (e.g. "add the first one", "add the second one", "add the cheaper one", "add the expensive one", "add that", "add this", "add the black one", "add that one")
  const ordinalAddMatch = lower.match(/^(?:please\s+|can\s+you\s+)?(?:add|put|place|buy|i\s+want)\s+(?:the\s+)?(first|1st|second|2nd|third|3rd|fourth|4th|last)\s+(?:one|product|item)?(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?$/i);
  if (ordinalAddMatch) {
    const word = ordinalAddMatch[1].toLowerCase();
    const ordMap: Record<string, number> = { 'first': 0, '1st': 0, 'second': 1, '2nd': 1, 'third': 2, '3rd': 2, 'fourth': 3, '4th': 3, 'last': -1 };
    return {
      type: 'ADD_TO_CART_SINGLE',
      rawMessage: raw,
      referenceType: 'ORDINAL',
      targetOrdinal: ordMap[word] !== undefined ? ordMap[word] : 0,
      confidence: 0.98,
    };
  }

  const extremumAddMatch = lower.match(/^(?:please\s+|can\s+you\s+)?(?:add|put|place|buy|i\s+want)\s+(?:the\s+)?(cheaper|cheapest|lowest\s+price|least\s+expensive|more\s+expensive|most\s+expensive|priciest)\s+(?:one|product|item)?(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?$/i);
  if (extremumAddMatch) {
    const extWord = extremumAddMatch[1].toLowerCase();
    const isCheapest = /(?:cheaper|cheapest|lowest|least)/i.test(extWord);
    return {
      type: 'ADD_TO_CART_SINGLE',
      rawMessage: raw,
      referenceType: 'EXTREMUM',
      targetExtremum: isCheapest ? 'cheapest' : 'expensive',
      confidence: 0.98,
    };
  }

  const pronounAddMatch = lower.match(/^(?:please\s+|can\s+you\s+)?(?:add|put|place|buy)\s+(that|this|it|that\s+one|this\s+one)(?:\s+(?:to|into|in)\s+(?:my\s+)?cart)?$/i);
  if (pronounAddMatch) {
    return {
      type: 'ADD_TO_CART_SINGLE',
      rawMessage: raw,
      referenceType: 'LAST_MENTIONED',
      confidence: 0.95,
    };
  }

  // K. Incremental Quantity / Update Quantity Intent
  // "add another one", "add one more", "make it two", "make that quantity 2"
  const isQtyUpdate =
    /(?:add\s+another|add\s+one\s+more|make\s+it\s+\d+|make\s+that\s+quantity\s+\d+|change\s+quantity\s+to\s+\d+|update\s+quantity)/i.test(lower);
  if (isQtyUpdate) {
    return {
      type: 'UPDATE_QUANTITY',
      rawMessage: raw,
      confidence: 0.9,
    };
  }

  // L. Search Refinements (e.g. "under 3000", "under ₹5000", "only show black ones", "show me cheaper ones", "only men's")
  // Only valid if there was a previous search query or recommendation set!
  if (state.lastSearchQuery || (state.lastRecommendedProducts && state.lastRecommendedProducts.length > 0)) {
    const isPurePriceConstraint = /^(?:under|below|less\s+than|<|at\s+most|above|>)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)$/i.test(lower);
    const isPureColorOrDemographic = /^(?:only\s+)?(?:show\s+)?(?:only\s+)?(black|blue|red|green|white|yellow|pink|men'?s|women'?s|kids?)(?:\s+ones|\s+jackets|\s+shoes|\s+products)?$/i.test(lower);

    if (isPurePriceConstraint || isPureColorOrDemographic) {
      const priceMatch = lower.match(/(?:under|below|less\s+than|<|at\s+most)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
      const aboveMatch = lower.match(/(?:above|over|more\s+than|>)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
      const colorMatch = lower.match(/\b(black|blue|red|green|white|yellow|pink|brown|grey|gray)\b/i);

      return {
        type: 'REFINE_SEARCH',
        rawMessage: raw,
        extractedPrice: {
          max: priceMatch ? parseFloat(priceMatch[1]) : undefined,
          min: aboveMatch ? parseFloat(aboveMatch[1]) : undefined,
        },
        extractedColor: colorMatch ? colorMatch[1].toLowerCase() : undefined,
        confidence: 0.95,
      };
    }
  }

  // M. Standard Add to Cart (e.g. "Add a jacket under 3000 and shoes")
  if (/^add\s+/i.test(lower) || /add\s+.+\s+to\s+cart/i.test(lower)) {
    return {
      type: 'ADD_TO_CART_SINGLE',
      rawMessage: raw,
      confidence: 0.85,
    };
  }

  // Default: General Product Search / Discovery Query
  return {
    type: 'NEW_SEARCH',
    rawMessage: raw,
    confidence: 0.8,
  };
}

/**
 * 2. RESOLVE ENTITIES AND REFERENCES AGAINST CONVERSATION STATE
 */
export function resolveReferences(
  intent: ClassifiedIntent,
  state: ConversationState,
  currentCart: RealCartState
): ResolvedEntities {
  const recs = state.lastRecommendedProducts || [];

  // 1. REMOVE_FROM_CART Entity Resolution
  if (intent.type === 'REMOVE_FROM_CART') {
    if (currentCart.items.length === 0) {
      return {
        resolvedProducts: [],
        isAmbiguous: false,
        isReferenceResolved: false,
        notFoundReason: 'Your shopping cart is currently empty.',
      };
    }

    // Ordinal removal (e.g. "remove the second one" -> currentCart.items[1])
    if (intent.targetOrdinal !== undefined) {
      const idx = intent.targetOrdinal === -1 ? currentCart.items.length - 1 : intent.targetOrdinal;
      if (idx >= 0 && idx < currentCart.items.length) {
        return {
          resolvedProducts: [],
          targetCartItem: currentCart.items[idx],
          isAmbiguous: false,
          isReferenceResolved: true,
        };
      }
      return {
        resolvedProducts: [],
        isAmbiguous: false,
        isReferenceResolved: false,
        notFoundReason: `Your cart only has ${currentCart.items.length} item(s). There is no item #${idx + 1}.`,
      };
    }

    // Keyword removal (e.g. "remove the jacket")
    const kw = (intent.targetKeyword || '').toLowerCase().trim();
    if (kw === 'that' || kw === 'it' || kw === 'this') {
      if (state.lastAddedProducts && state.lastAddedProducts.length > 0) {
        const lastAddedId = state.lastAddedProducts[state.lastAddedProducts.length - 1].productId;
        const match = currentCart.items.find(i => String(i.productId) === String(lastAddedId));
        if (match) {
          return {
            resolvedProducts: [],
            targetCartItem: match,
            isAmbiguous: false,
            isReferenceResolved: true,
          };
        }
      }
      if (currentCart.items.length === 1) {
        return {
          resolvedProducts: [],
          targetCartItem: currentCart.items[0],
          isAmbiguous: false,
          isReferenceResolved: true,
        };
      }
      return {
        resolvedProducts: [],
        isAmbiguous: true,
        ambiguousCartItems: currentCart.items,
        isReferenceResolved: false,
      };
    }

    const matches = currentCart.items.filter(item => {
      const name = item.name.toLowerCase();
      const cat = (item.category || '').toLowerCase();
      return name.includes(kw) || kw.includes(name) || cat.includes(kw) || kw.includes(cat);
    });

    if (matches.length === 1) {
      return {
        resolvedProducts: [],
        targetCartItem: matches[0],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    if (matches.length > 1) {
      return {
        resolvedProducts: [],
        isAmbiguous: true,
        ambiguousCartItems: matches,
        isReferenceResolved: false,
      };
    }

    return {
      resolvedProducts: [],
      isAmbiguous: false,
      isReferenceResolved: false,
      notFoundReason: `I couldn't find any item matching "${intent.targetKeyword}" in your cart.`,
    };
  }

  // 2. ADD_TO_CART_ALL -> resolve all recommendations
  if (intent.type === 'ADD_TO_CART_ALL') {
    if (recs.length > 0) {
      return {
        resolvedProducts: [...recs],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }
    return {
      resolvedProducts: [],
      isAmbiguous: false,
      isReferenceResolved: false,
      notFoundReason: "I don't have any recent product recommendations to add to your cart.",
    };
  }

  // 2. ADD_TO_CART_SINGLE / VIEW_PRODUCT with ORDINAL Reference
  if (intent.referenceType === 'ORDINAL' && intent.targetOrdinal !== undefined) {
    if (recs.length === 0) {
      return {
        resolvedProducts: [],
        isAmbiguous: false,
        isReferenceResolved: false,
        notFoundReason: "I don't have any previous recommendations to select from.",
      };
    }

    const idx = intent.targetOrdinal === -1 ? recs.length - 1 : intent.targetOrdinal;
    if (idx >= 0 && idx < recs.length) {
      return {
        resolvedProducts: [recs[idx]],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    return {
      resolvedProducts: [],
      isAmbiguous: false,
      isReferenceResolved: false,
      notFoundReason: `I only recommended ${recs.length} product(s). There is no product #${idx + 1}.`,
    };
  }

  // 3. ADD_TO_CART_SINGLE with EXTREMUM Reference ("cheaper one", "most expensive one")
  if (intent.referenceType === 'EXTREMUM' && intent.targetExtremum) {
    if (recs.length === 0) {
      return {
        resolvedProducts: [],
        isAmbiguous: false,
        isReferenceResolved: false,
        notFoundReason: "I don't have any previous recommendations to compare prices for.",
      };
    }

    const sorted = [...recs].sort((a, b) => a.price - b.price);
    const targetProduct = intent.targetExtremum === 'cheapest' ? sorted[0] : sorted[sorted.length - 1];

    return {
      resolvedProducts: [targetProduct],
      isAmbiguous: false,
      isReferenceResolved: true,
    };
  }

  // 4. ADD_TO_CART_SINGLE with LAST_MENTIONED / PRONOUN Reference ("that", "this", "it")
  if (intent.referenceType === 'LAST_MENTIONED') {
    // Priority:
    // a. lastComparedProducts (e.g. if user just asked "which one is cheapest?")
    // b. lastMentionedProducts
    // c. lastViewedProduct
    // d. if exactly 1 recommendation was shown, that recommendation
    if (state.lastComparedProducts && state.lastComparedProducts.length > 0) {
      return {
        resolvedProducts: [state.lastComparedProducts[0]],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    if (state.lastMentionedProducts && state.lastMentionedProducts.length > 0) {
      return {
        resolvedProducts: [state.lastMentionedProducts[0]],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    if (state.lastViewedProduct) {
      return {
        resolvedProducts: [state.lastViewedProduct],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    if (recs.length === 1) {
      return {
        resolvedProducts: [recs[0]],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    if (recs.length > 1) {
      // If multiple recommendations exist, user saying "add that" might mean the first one or require disambiguation
      return {
        resolvedProducts: [recs[0]],
        isAmbiguous: false,
        isReferenceResolved: true,
      };
    }

    return {
      resolvedProducts: [],
      isAmbiguous: false,
      isReferenceResolved: false,
      notFoundReason: "Which product are you referring to? Please specify the product name or number.",
    };
  }



  // 6. REFINE_SEARCH Context Inheritance
  if (intent.type === 'REFINE_SEARCH') {
    const existingFilters = state.lastSearchFilters || {};
    const inherited: ConversationFilters = {
      ...existingFilters,
      maxPrice: intent.extractedPrice?.max !== undefined ? intent.extractedPrice.max : existingFilters.maxPrice,
      minPrice: intent.extractedPrice?.min !== undefined ? intent.extractedPrice.min : existingFilters.minPrice,
      color: intent.extractedColor || existingFilters.color,
    };

    return {
      resolvedProducts: [],
      inheritedFilters: inherited,
      isAmbiguous: false,
      isReferenceResolved: true,
    };
  }

  // Default: Not a direct state reference
  return {
    resolvedProducts: [],
    isAmbiguous: false,
    isReferenceResolved: false,
  };
}
