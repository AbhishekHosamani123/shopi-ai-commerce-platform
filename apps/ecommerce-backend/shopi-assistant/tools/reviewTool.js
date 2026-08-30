/**
 * Review Intelligence Tool (Phase 9 & 14)
 *
 * Retrieves verified review summaries, customer sentiment, pros/cons,
 * and individual verified reviews for a specific product.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '../../data/shopi-pipeline/output');

let reviewsCache = null;
let summaryCache = null;

function loadReviewData() {
  if (!reviewsCache) {
    reviewsCache = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'reviews.json'), 'utf8'));
  }
  if (!summaryCache) {
    summaryCache = JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, 'review-summary.json'), 'utf8'));
  }
  return { reviewsCache, summaryCache };
}

function executeGetProductReviews(productId, topic = null) {
  if (!productId) return null;
  const { reviewsCache, summaryCache } = loadReviewData();

  const summary = summaryCache.find(s => s.product_id === productId);
  const reviews = reviewsCache.filter(r => r.product_id === productId);

  if (!summary && reviews.length === 0) {
    return {
      product_id: productId,
      has_reviews: false,
      message: "I don't have enough customer review data for this product."
    };
  }

  // Filter reviews by topic if specified (e.g. "comfort", "durability", "size", "fit")
  let relevantReviews = reviews;
  if (topic) {
    const tLower = topic.toLowerCase();
    relevantReviews = reviews.filter(r =>
      (r.comment || r.title || '').toLowerCase().includes(tLower)
    );
    if (relevantReviews.length === 0) relevantReviews = reviews.slice(0, 3);
  }

  return {
    product_id: productId,
    has_reviews: true,
    average_rating: summary?.average_rating || null,
    review_count: summary?.review_count || reviews.length,
    pros: summary?.pros || [],
    cons: summary?.cons || [],
    fit_feedback: summary?.fit_feedback || null,
    comfort_feedback: summary?.comfort_feedback || null,
    buying_advice: summary?.buying_advice || null,
    sample_reviews: relevantReviews.slice(0, 3).map(r => ({
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      sentiment: r.sentiment,
      verified_purchase: r.verified_purchase
    }))
  };
}

module.exports = { executeGetProductReviews };
