/**
 * Shopi Conversation State Manager (Phase 4)
 *
 * Manages conversational memory across turns, progressive constraint merging,
 * and conversational entity/reference resolution ("this one", "the first one", "the cheaper one").
 */

const crypto = require('crypto');

// In-memory active conversation session store
const conversationStore = new Map();

function createInitialState(conversationId) {
  return {
    conversation_id: conversationId || crypto.randomUUID(),
    turn_count: 0,
    constraints: {
      category: null,
      brand: null,
      min_price: null,
      max_price: null,
      color: null,
      size: null,
      material: null,
      occasion: null,
      use_case: null,
      gender: null
    },
    active_selection: null, // SKU of currently focused product
    last_results: [],      // Array of candidate products from last retrieval
    last_comparison: null, // Last compared products
    last_intent: null,
    history: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

function getConversationState(conversationId) {
  if (!conversationId) {
    const newState = createInitialState();
    conversationStore.set(newState.conversation_id, newState);
    return newState;
  }

  if (!conversationStore.has(conversationId)) {
    const newState = createInitialState(conversationId);
    conversationStore.set(conversationId, newState);
    return newState;
  }

  return conversationStore.get(conversationId);
}

function updateConversationState(conversationId, updates = {}) {
  const state = getConversationState(conversationId);
  state.turn_count++;
  state.updated_at = new Date().toISOString();

  if (updates.constraints) {
    // Progressive constraint merge: only overwrite non-null new values
    for (const [key, value] of Object.entries(updates.constraints)) {
      if (value !== null && value !== undefined) {
        state.constraints[key] = value;
      }
    }
  }

  if (updates.active_selection !== undefined) state.active_selection = updates.active_selection;
  if (updates.last_results !== undefined) state.last_results = updates.last_results;
  if (updates.last_comparison !== undefined) state.last_comparison = updates.last_comparison;
  if (updates.last_intent !== undefined) state.last_intent = updates.last_intent;

  if (updates.user_message) {
    state.history.push({
      role: 'user',
      message: updates.user_message,
      timestamp: new Date().toISOString()
    });
  }

  if (updates.assistant_message) {
    state.history.push({
      role: 'assistant',
      message: updates.assistant_message,
      intent: state.last_intent,
      timestamp: new Date().toISOString()
    });
  }

  // Keep history manageable
  if (state.history.length > 20) {
    state.history = state.history.slice(-20);
  }

  return state;
}

/**
 * Resolves conversational product references:
 *   "this one", "it", "the first one", "second shoe", "cheaper one", "the white one"
 */
function resolveProductReference(queryText, state) {
  if (!state || !state.last_results || state.last_results.length === 0) {
    return state?.active_selection || null;
  }

  const query = queryText.toLowerCase();

  // 1. Ordinal references ("first one", "1st", "second", "2nd", "last one")
  if (query.match(/\b(?:first|1st|top|first one)\b/)) return state.last_results[0]?.sku || state.last_results[0]?.product_id;
  if (query.match(/\b(?:second|2nd|second one)\b/)) return state.last_results[1]?.sku || state.last_results[1]?.product_id;
  if (query.match(/\b(?:third|3rd|third one)\b/)) return state.last_results[2]?.sku || state.last_results[2]?.product_id;
  if (query.match(/\b(?:last|last one)\b/)) return state.last_results[state.last_results.length - 1]?.sku || state.last_results[state.last_results.length - 1]?.product_id;

  // 2. Relative price references ("the cheaper one", "cheapest", "costlier one")
  if (query.match(/\b(?:cheaper|cheapest|budget one|lowest price)\b/)) {
    const sorted = [...state.last_results].sort((a, b) => a.selling_price - b.selling_price);
    return sorted[0]?.sku || sorted[0]?.product_id;
  }
  if (query.match(/\b(?:expensive|costlier|premium one|highest price)\b/)) {
    const sorted = [...state.last_results].sort((a, b) => b.selling_price - a.selling_price);
    return sorted[0]?.sku || sorted[0]?.product_id;
  }

  // 3. Pronouns ("this", "this one", "it", "that one") -> uses active selection or first item
  if (query.match(/\b(?:this|this one|that|that one|it)\b/)) {
    return state.active_selection || state.last_results[0]?.sku || state.last_results[0]?.product_id;
  }

  // 4. Color / Brand / SKU direct mention
  for (const prod of state.last_results) {
    if (prod.sku && query.includes(prod.sku.toLowerCase())) return prod.sku;
    if (prod.brand && query.includes(prod.brand.toLowerCase())) return prod.sku;
  }

  return state.active_selection || state.last_results[0]?.sku || null;
}

module.exports = {
  createInitialState,
  getConversationState,
  updateConversationState,
  resolveProductReference,
  conversationStore
};
