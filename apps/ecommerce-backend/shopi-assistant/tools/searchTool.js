/**
 * Search Tool (Phase 14)
 *
 * Interfaces between Shopi conversational state and the verified hybrid retrieval engine.
 */

const { searchProducts, parseQuery } = require('../../data/shopi-pipeline/scripts/hybrid-retrieval');

async function executeSearch(queryText, conversationState = {}, options = {}) {
  // Extract constraints from new message
  const parsed = parseQuery(queryText);

  // Merge progressive constraints from state
  const mergedHard = {
    ...conversationState.constraints,
    ...parsed.hard
  };

  // If new category or search term is completely different, reset category
  if (parsed.hard.category) {
    mergedHard.category = parsed.hard.category;
  }

  const explicitConstraints = {
    hard: mergedHard,
    soft: parsed.soft
  };

  const searchResult = await searchProducts(queryText, explicitConstraints, options);

  return {
    query: queryText,
    parsed_constraints: searchResult.parsed_constraints,
    match_status: searchResult.match_status,
    total_candidates: searchResult.total_candidates,
    products: searchResult.results,
    relaxed_alternatives: searchResult.relaxed_alternatives || []
  };
}

module.exports = { executeSearch };
