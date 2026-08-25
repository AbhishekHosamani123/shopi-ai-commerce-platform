import { client } from '../data/DB';
import { ProductSimilarity, SubstitutionConfidence } from './cannibalization-types';

/**
 * Calculates attribute similarity and substitution likelihood between two products.
 */
export function calculateProductSimilarity(p1: any, p2: any): ProductSimilarity {
  const categoryMatch = p1.categoryid === p2.categoryid;

  const tags1 = (p1.tags || '').toLowerCase().split(',').map((t: string) => t.trim()).filter(Boolean);
  const tags2 = (p2.tags || '').toLowerCase().split(',').map((t: string) => t.trim()).filter(Boolean);
  const tagOverlap = tags1.filter((t: string) => tags2.includes(t)).length;

  const price1 = parseFloat(p1.price || '0');
  const price2 = parseFloat(p2.price || '0');
  const maxPrice = Math.max(price1, price2, 1);
  const priceDiff = Math.abs(price1 - price2);
  const priceRatio = Math.max(0, 1 - (priceDiff / maxPrice)); // 1.0 means identical price

  // Text title token overlap
  const words1 = (p1.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
  const words2 = (p2.title || '').toLowerCase().split(/\s+/).filter((w: string) => w.length > 2);
  const wordOverlap = words1.filter((w: string) => words2.includes(w)).length;

  // Composite Similarity Score (0.0 to 1.0)
  let score = 0;
  if (categoryMatch) score += 0.40;
  score += Math.min(0.25, tagOverlap * 0.10);
  score += Math.min(0.20, wordOverlap * 0.10);
  score += (priceRatio * 0.15);

  const similarityScore = parseFloat(Math.min(0.99, score).toFixed(2));

  let confidence: SubstitutionConfidence = 'LOW';
  if (similarityScore >= 0.70) confidence = 'HIGH';
  else if (similarityScore >= 0.45) confidence = 'MEDIUM';

  return {
    productIdA: p1.productid,
    productTitleA: p1.title,
    productIdB: p2.productid,
    productTitleB: p2.title,
    categoryMatch,
    tagOverlapCount: tagOverlap,
    priceRatio: parseFloat(priceRatio.toFixed(2)),
    similarityScore,
    substitutionConfidence: confidence
  };
}

/**
 * Finds top substitutable / similar products across the catalog for a given SKU.
 */
export async function findSimilarProducts(productId: number, limit: number = 5): Promise<ProductSimilarity[]> {
  const targetRes = await client.query('SELECT * FROM products WHERE productid = $1', [productId]);
  if (targetRes.rows.length === 0) return [];
  const target = targetRes.rows[0];

  const allRes = await client.query('SELECT * FROM products WHERE productid != $1', [productId]);
  const similarities = allRes.rows.map(p => calculateProductSimilarity(target, p));

  return similarities
    .filter(s => s.similarityScore >= 0.40)
    .sort((a, b) => b.similarityScore - a.similarityScore)
    .slice(0, limit);
}
