/**
 * Product Comparison Tool (Phase 8 & 14)
 *
 * Performs deterministic, explainable multi-attribute comparison between 2 or more products
 * using ONLY verified product facts from Supabase / canonical outputs.
 */

const { getVerifiedProductFacts } = require('../../data/shopi-pipeline/scripts/hybrid-retrieval');

function executeCompareProducts(productIds, criterion = null) {
  if (!productIds || productIds.length < 2) return null;

  const products = productIds.map(id => getVerifiedProductFacts(id)).filter(Boolean);
  if (products.length < 2) return null;

  const comparison = products.map(p => {
    const advantages = [];
    const limitations = [];

    // Pricing assessment
    const otherPrices = products.filter(x => x.sku !== p.sku).map(x => x.price);
    const minPrice = Math.min(...otherPrices);
    if (p.price <= minPrice) {
      advantages.push(`Lowest price (₹${p.price}) among compared options`);
    }

    if (p.discount && p.discount >= 60) {
      advantages.push(`High discount (${p.discount}% off)`);
    }

    // Rating assessment
    if (p.rating && p.rating >= 4.0) {
      advantages.push(`High customer rating (${p.rating}★ across ${p.review_count} reviews)`);
    }

    // Pros / Strengths
    if (p.review_summary?.pros && p.review_summary.pros.length > 0) {
      advantages.push(`Key Strengths: ${p.review_summary.pros.slice(0, 2).join(', ')}`);
    }

    // Cons / Considerations
    if (p.review_summary?.cons && p.review_summary.cons.length > 0) {
      limitations.push(`Customer Considerations: ${p.review_summary.cons.slice(0, 2).join(', ')}`);
    }

    return {
      product_id: p.product_id,
      sku: p.sku,
      title: p.title,
      price: p.price,
      mrp: p.mrp,
      discount: p.discount,
      rating: p.rating,
      review_count: p.review_count,
      material: p.attributes.material,
      colors: p.variants.colors,
      sizes: p.variants.sizes,
      advantages,
      limitations,
      image: p.image
    };
  });

  // Determine top recommendation based on criterion
  let recommendationSummary = '';
  if (criterion && criterion.toLowerCase().includes('running')) {
    const sports = comparison.find(c => (c.title + ' ' + (c.advantages.join(' '))).toLowerCase().includes('running'));
    if (sports) {
      recommendationSummary = `For running, **${sports.title}** (₹${sports.price}) is the stronger choice due to its running-focused design and feedback.`;
    }
  } else if (criterion && criterion.toLowerCase().includes('review')) {
    const bestRated = [...comparison].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (bestRated) {
      recommendationSummary = `In terms of customer satisfaction, **${bestRated.title}** leads with a rating of **${bestRated.rating}★** (${bestRated.review_count} reviews).`;
    }
  } else {
    const cheapest = [...comparison].sort((a, b) => a.price - b.price)[0];
    const bestRated = [...comparison].sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    if (cheapest.sku === bestRated.sku) {
      recommendationSummary = `**${cheapest.title}** is both the best value (₹${cheapest.price}) and highest rated (${cheapest.rating}★).`;
    } else {
      recommendationSummary = `**${cheapest.title}** is the budget-friendly pick at ₹${cheapest.price}, while **${bestRated.title}** has higher customer ratings (${bestRated.rating}★ at ₹${bestRated.price}).`;
    }
  }

  return {
    compared_count: comparison.length,
    products: comparison,
    recommendation_summary: recommendationSummary
  };
}

module.exports = { executeCompareProducts };
