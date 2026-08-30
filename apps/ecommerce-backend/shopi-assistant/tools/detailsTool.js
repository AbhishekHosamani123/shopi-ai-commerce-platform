/**
 * Product Details Tool (Phase 10 & 14)
 *
 * Retrieves 100% verified factual data for a product. Nulls remain null.
 */

const { getVerifiedProductFacts } = require('../../data/shopi-pipeline/scripts/hybrid-retrieval');

function executeGetProductDetails(productId) {
  if (!productId) return null;
  const facts = getVerifiedProductFacts(productId);
  if (!facts) return null;

  return facts;
}

module.exports = { executeGetProductDetails };
