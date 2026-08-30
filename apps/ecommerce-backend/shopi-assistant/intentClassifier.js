/**
 * Shopi Intent Classifier (Phase 3)
 *
 * Classifies customer queries into 14 distinct shopping intents with high precision.
 */

function classifyIntent(messageText, conversationState = {}) {
  const query = messageText.toLowerCase().trim();
  const hasPreviousResults = conversationState.last_results && conversationState.last_results.length > 0;

  // 1. Cart & Checkout Intents
  if (query.match(/\b(?:add\s+(?:.+?\s+)?to\s+cart|add\s+(?:this|it|the\s+\w+|\w+)?\s*to\s+cart|buy\s+(?:this|now)|add\s+to\s+bag|put\s+in\s+cart)\b/)) {
    return 'CART_ADD';
  }
  if (query.match(/\b(?:remove\s+(?:from\s+)?cart|delete\s+from\s+cart)\b/)) return 'CART_REMOVE';
  if (query.match(/\b(?:show\s+(?:my\s+)?cart|view\s+cart|what(?:'s|\s+is)\s+in\s+my\s+cart)\b/)) return 'CART_VIEW';
  if (query.match(/\b(?:checkout|proceed\s+to\s+pay|buy\s+all|place\s+order)\b/)) return 'CHECKOUT_START';

  // 2. Comparison Intent
  if (
    query.match(/\b(?:compare|comparison|versus|vs\.?|which\s+(?:one\s+)?is\s+better|which\s+(?:is\s+)?better|difference\s+between)\b/) ||
    (hasPreviousResults && query.match(/\b(?:which\s+(?:one|should\s+i\s+buy|to\s+choose))\b/))
  ) {
    return 'PRODUCT_COMPARISON';
  }

  // 3. Review & Customer Feedback Intent
  if (
    query.match(/\b(?:reviews?|ratings?|feedback|what\s+do\s+customers\s+say|complaints?|pros\s+and\s+cons|is\s+it\s+(?:durable|comfortable|worth\s+it))\b/)
  ) {
    return 'REVIEW_QUERY';
  }

  // 4. Price Query
  if (query.match(/\b(?:how\s+much\s+(?:is|does)|what\s+is\s+the\s+price|cost\s+of\s+this|mrp)\b/)) {
    return 'PRICE_QUERY';
  }

  // 5. Size & Fit Query
  if (query.match(/\b(?:what\s+sizes?|available\s+sizes?|size\s+chart|fit\s+true\s+to\s+size|how\s+does\s+it\s+fit)\b/)) {
    return 'SIZE_QUERY';
  }

  // 6. Color Query
  if (query.match(/\b(?:what\s+colors?|other\s+colors?|available\s+in\s+other\s+colors?|color\s+options)\b/)) {
    return 'COLOR_QUERY';
  }

  // 7. Product Details Intent
  if (
    query.match(/\b(?:tell\s+me\s+about|details?\s+of|more\s+info|specs?|specifications?|describe|what\s+is\s+the\s+material|what\s+fabric)\b/) ||
    (hasPreviousResults && query.match(/\b(?:tell\s+me\s+more|show\s+details|info\s+on\s+this)\b/))
  ) {
    return 'PRODUCT_DETAILS';
  }

  // 8. General Greetings / Chit-Chat
  if (query.match(/^(?:hi|hello|hey|greetings|help|who\s+are\s+you)\b/)) {
    return 'GENERAL_SHOPPING';
  }

  // 9. Refinement Intent (Context continuation: modifying existing search results)
  if (hasPreviousResults) {
    if (
      query.match(/^(?:only\s+|just\s+|show\s+me\s+)?(?:black|white|blue|navy|grey|brown|green|red|pink|beige)(?:\s+ones?)?$/) ||
      query.match(/^(?:only\s+|just\s+)?(?:under|below|less than|within)\s*(?:rs\.?|inr|₹)?\s*\d+$/) ||
      query.match(/^(?:only\s+|in\s+)?(?:size\s+[a-z0-9\s]+|[a-z0-9\s]+\s+uk)$/i) ||
      query.match(/\b(?:show\s+me\s+cheaper|cheaper\s+options|higher\s+budget|different\s+color|different\s+size|only\s+(?:my\s+)?size|what\s+about\s+[a-z]+|top\s+rated|better\s+rated|filter\s+by)\b/)
    ) {
      return 'PRODUCT_REFINEMENT';
    }
  }

  // 10. General Recommendation
  if (query.match(/\b(?:what\s+do\s+you\s+recommend|suggest\s+me|best\s+options|top\s+picks|curated\s+for\s+me)\b/)) {
    return 'PRODUCT_RECOMMENDATION';
  }

  // 11. Default Search Intent
  if (
    query.match(/\b(?:show|find|search|looking\s+for|need|want|buy|browse|get\s+me)\b/) ||
    query.length >= 3
  ) {
    return 'PRODUCT_SEARCH';
  }

  return 'UNKNOWN';
}

module.exports = { classifyIntent };
