/**
 * SemanticProductMatcher.ts
 * 
 * Intelligent semantic normalization, synonym mapping, demographic alignment,
 * and relevance scoring for Shopi AI product discovery and cart resolution.
 */

export interface SemanticIntent {
  rawQuery: string;
  normalizedKeywords: string[];
  demographic: 'men' | 'women' | 'kids' | 'unspecified';
  primaryCategory: string | null;
  subType: string | null;
  isSpecificRunningSport: boolean;
  maxPrice: number | null;
  minPrice: number | null;
  exactPrice: number | null;
}

export interface ScoredProduct {
  product: any;
  score: number;
  price: number;
  matchReasons: string[];
}

/**
 * 1. SYNONYM & INTENT DICTIONARIES
 */
const DEMOGRAPHIC_MAP: Record<string, 'men' | 'women' | 'kids'> = {
  // Men
  men: 'men',
  mens: 'men',
  "men's": 'men',
  man: 'men',
  male: 'men',
  males: 'men',
  boy: 'men',
  boys: 'men',
  "boy's": 'men',
  gentleman: 'men',
  gentlemen: 'men',

  // Women
  women: 'women',
  womens: 'women',
  "women's": 'women',
  woman: 'women',
  female: 'women',
  females: 'women',
  girl: 'women',
  girls: 'women',
  "girl's": 'women',
  lady: 'women',
  ladies: 'women',

  // Kids & Baby
  kid: 'kids',
  kids: 'kids',
  "kid's": 'kids',
  child: 'kids',
  children: 'kids',
  "children's": 'kids',
  baby: 'kids',
  babies: 'kids',
  "baby's": 'kids',
  infant: 'kids',
  infants: 'kids',
  toddler: 'kids',
  toddlers: 'kids',
};

const SYNONYM_GROUPS: Record<string, string[]> = {
  shoes: ['shoe', 'shoes', 'footwear', 'footwears', 'sneaker', 'sneakers', 'trainer', 'trainers', 'kicks', 'boot', 'boots', 'loafers', 'sandals'],
  running: ['running', 'jogging', 'trekking', 'sports', 'sport', 'athletic', 'workout', 'training', 'marathon'],
  jacket: ['jacket', 'jackets', 'outerwear', 'coat', 'coats', 'fleece', 'windbreaker', 'parka', 'blazer'],
  hat: ['hat', 'hats', 'cap', 'caps', 'headwear', 'woolen hat', 'beanie', 'beret'],
  shirt: ['shirt', 'shirts', 'formal shirt', 'casual shirt', 'cotton shirt', 'full sleeves'],
  tshirt: ['t-shirt', 't-shirts', 'tshirt', 'tshirts', 'tee', 'tees', 'hoodie', 'hoodies', 'sweatshirt'],
  top: ['top', 'tops', 'blouse', 'blouses', 'embro top', 'tunic', 'tunics'],
  skirt: ['skirt', 'skirts', 'midi skirt', 'wrap skirt', 'dress'],
  shorts: ['short', 'shorts', 'sweatshorts', 'jeans', 'trousers', 'pants'],
  watch: ['watch', 'watches', 'smartwatch', 'smart watch', 'timepiece'],
  jewellery: ['jewellery', 'jewelry', 'ring', 'rings', 'necklace', 'earrings', 'earring', 'pendant', 'chain', 'bangles', 'bracelets'],
  perfume: ['perfume', 'perfumes', 'fragrance', 'cologne', 'deodorant', 'body mist'],
  cosmetics: ['cosmetics', 'shampoo', 'conditioner', 'bodywash', 'facewash', 'soap', 'lotion', 'lipstick', 'makeup'],
};

/**
 * 2. SEMANTIC INTENT PARSER
 */
export function extractSemanticIntent(query: string): SemanticIntent {
  const rawLower = (query || '').toLowerCase().trim();
  const tokens = rawLower
    .replace(/[^\w\s'-]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);

  // A. Extract Demographics
  let demographic: 'men' | 'women' | 'kids' | 'unspecified' = 'unspecified';
  for (const t of tokens) {
    if (DEMOGRAPHIC_MAP[t]) {
      demographic = DEMOGRAPHIC_MAP[t];
      break;
    }
  }

  // B. Extract Price Constraints
  let maxPrice: number | null = null;
  let minPrice: number | null = null;
  let exactPrice: number | null = null;

  const underMatch = rawLower.match(/(?:under|below|less\s+than|within|<|at\s+most)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (underMatch) maxPrice = parseFloat(underMatch[1]);

  const aboveMatch = rawLower.match(/(?:above|over|more\s+than|>|at\s+least)\s*(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d+)?)/i);
  if (aboveMatch) minPrice = parseFloat(aboveMatch[1]);

  const exactMatch = rawLower.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)/i) || rawLower.match(/\b(\d+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|rupees|bucks)\b/i);
  if (exactMatch && maxPrice === null && minPrice === null) {
    exactPrice = parseFloat(exactMatch[1]);
  }

  // C. Identify Primary Product Type & SubType
  let primaryCategory: string | null = null;
  let subType: string | null = null;
  let isSpecificRunningSport = false;

  const hasRunning = /(?:running|trekking|jogging|sports?|athletic)/i.test(rawLower);
  const hasShoes = /(?:shoes?|footwears?|sneakers?|trainers?|kicks?|boots?)/i.test(rawLower);
  const hasJacket = /(?:jackets?|outerwears?|coats?|fleece)/i.test(rawLower);
  const hasHat = /(?:hats?|caps?|headwears?|beanies?)/i.test(rawLower);
  const hasTop = /(?:tops?|blouses?|embro)/i.test(rawLower);
  const hasTShirt = /(?:t-?shirts?|tees?|hoodies?)/i.test(rawLower);
  const hasShirt = !hasTShirt && /(?:shirts?)/i.test(rawLower);
  const hasWatch = /(?:watch(?:es)?|smartwatch(?:es)?)/i.test(rawLower);
  const hasJewellery = /(?:necklace|rings?|earrings?|jewell?ery|zircon|platinum)/i.test(rawLower);
  const hasPerfume = /(?:perfumes?|fragrances?|deodorants?)/i.test(rawLower);

  if (hasRunning && hasShoes) {
    primaryCategory = 'shoes';
    subType = 'running_sports';
    isSpecificRunningSport = true;
  } else if (hasShoes) {
    primaryCategory = 'shoes';
    if (hasRunning) {
      subType = 'running_sports';
      isSpecificRunningSport = true;
    }
  } else if (hasJacket) {
    primaryCategory = 'jacket';
  } else if (hasHat) {
    primaryCategory = 'hat';
  } else if (hasTop) {
    primaryCategory = 'top';
  } else if (hasTShirt) {
    primaryCategory = 'tshirt';
  } else if (hasShirt) {
    primaryCategory = 'shirt';
  } else if (hasWatch) {
    primaryCategory = 'watch';
  } else if (hasJewellery) {
    primaryCategory = 'jewellery';
  } else if (hasPerfume) {
    primaryCategory = 'perfume';
  }

  return {
    rawQuery: query,
    normalizedKeywords: tokens,
    demographic,
    primaryCategory,
    subType,
    isSpecificRunningSport,
    maxPrice,
    minPrice,
    exactPrice,
  };
}

/**
 * 3. PRODUCT RELEVANCE SCORER
 */
export function scoreProduct(product: any, intent: SemanticIntent): ScoredProduct {
  let score = 0;
  const matchReasons: string[] = [];

  const title = (product.title || product.name || '').toLowerCase();
  const desc = (product.description || '').toLowerCase();
  const tags = (product.tags || '').toLowerCase();
  const categoryName = (product.category_name || product.category || '').toLowerCase();
  const mainCat = (product.maincategory || '').toLowerCase();

  const price = parseFloat(product.discount || product.price?.amount || product.price || 0);

  // Price constraints check
  if (intent.maxPrice !== null && price > intent.maxPrice) {
    return { product, score: -1000, price, matchReasons: ['Exceeds max price constraint'] };
  }
  if (intent.minPrice !== null && price < intent.minPrice) {
    return { product, score: -1000, price, matchReasons: ['Below min price constraint'] };
  }

  // 1. Exact or Substring Title Match
  const rawQueryLower = intent.rawQuery.toLowerCase().trim();
  if (title === rawQueryLower) {
    score += 150;
    matchReasons.push('Exact full title match (+150)');
  } else if (title.includes(rawQueryLower) || rawQueryLower.includes(title)) {
    score += 80;
    matchReasons.push('Title substring match (+80)');
  }

  // 2. Token Matching in Title, Tags, Categories
  for (const token of intent.normalizedKeywords) {
    if (['find', 'me', 'some', 'the', 'a', 'an', 'add', 'in', 'to', 'for', 'with', 'under', 'below'].includes(token)) continue;
    const singular = token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token;

    if (title.includes(token) || title.includes(singular)) {
      score += 25;
      matchReasons.push(`Title token match: "${token}" (+25)`);
    }
    if (tags.includes(token) || tags.includes(singular)) {
      score += 15;
      matchReasons.push(`Tag token match: "${token}" (+15)`);
    }
    if (categoryName.includes(token) || categoryName.includes(singular)) {
      score += 20;
      matchReasons.push(`Category token match: "${token}" (+20)`);
    }
    if (mainCat.includes(token) || mainCat.includes(singular)) {
      score += 15;
      matchReasons.push(`MainCategory token match: "${token}" (+15)`);
    }
  }

  // 3. Category & Product Type Alignment
  if (intent.primaryCategory === 'shoes') {
    const isFootwear = categoryName.includes('footwear') || mainCat.includes('footwear') || title.includes('shoe') || tags.includes('shoes');
    if (isFootwear) {
      score += 60;
      matchReasons.push('Primary Category: Footwear match (+60)');
    } else {
      score -= 500;
      matchReasons.push('Not Footwear penalty (-500)');
    }

    // Specific Running / Sports Shoes Intent
    if (intent.isSpecificRunningSport || intent.subType === 'running_sports') {
      const isRunningOrSport = title.includes('running') || title.includes('trekking') || title.includes('sport') || tags.includes('running') || categoryName.includes('sport');
      if (isRunningOrSport) {
        score += 150;
        matchReasons.push('Running/Sports shoes specialty match (+150)');
      } else {
        score -= 500;
        matchReasons.push('Non-running shoes disqualification (-500)');
      }
    }

    // Demographic Demotion for Baby/Kids Shoes when query is generic
    const isBabyProduct = title.includes('baby') || tags.includes('baby') || desc.includes('baby') || title.includes('kids');
    if (isBabyProduct) {
      if (intent.demographic === 'kids') {
        score += 150;
        matchReasons.push('Kids/Baby shoes explicitly requested (+150)');
      } else {
        // Demote baby shoes on generic "shoes" queries so adult shoes are prioritized
        score -= 200;
        matchReasons.push('Demote baby shoes on general footwear query (-200)');
      }
    }
  }

  if (intent.primaryCategory === 'jacket') {
    const isJacket = categoryName.includes('jacket') || mainCat.includes('jacket') || title.includes('jacket') || tags.includes('jacket');
    if (isJacket) {
      score += 100;
      matchReasons.push('Primary Category: Jacket match (+100)');
    } else {
      score -= 500;
      matchReasons.push('Not Jacket penalty (-500)');
    }
  }

  if (intent.primaryCategory === 'hat') {
    const isHat = title.includes('hat') || tags.includes('hat') || categoryName.includes('hat') || title.includes('cap');
    if (isHat) {
      score += 100;
      matchReasons.push('Primary Category: Hat match (+100)');
    } else {
      score -= 500;
      matchReasons.push('Not Hat penalty (-500)');
    }
  }

  if (intent.primaryCategory === 'top') {
    const isTop = title.includes('top') || tags.includes('top') || categoryName.includes('top') || title.includes('blouse');
    if (isTop) {
      score += 100;
      matchReasons.push('Primary Category: Top match (+100)');
    } else {
      score -= 500;
      matchReasons.push('Not Top penalty (-500)');
    }
  }

  // 4. Demographic / Audience Alignment
  const isMenProduct = mainCat === 'men' || categoryName.includes('men') || title.toLowerCase().includes('men') || tags.includes('men') || tags.includes('mens');
  const isWomenProduct = mainCat === 'women' || categoryName.includes('women') || title.toLowerCase().includes('women') || title.toLowerCase().includes('girls') || tags.includes('women') || tags.includes('girls');
  const isKidsProduct = title.toLowerCase().includes('baby') || title.toLowerCase().includes('kids') || tags.includes('baby') || tags.includes('kids');

  if (intent.demographic === 'men') {
    if (isMenProduct && !isKidsProduct) {
      score += 50;
      matchReasons.push("Men's demographic alignment (+50)");
    } else if (isWomenProduct || isKidsProduct) {
      score -= 40;
      matchReasons.push("Non-men demographic mismatch penalty (-40)");
    }
  } else if (intent.demographic === 'women') {
    if (isWomenProduct && !isKidsProduct) {
      score += 50;
      matchReasons.push("Women's demographic alignment (+50)");
    } else if (isMenProduct) {
      score -= 40;
      matchReasons.push("Non-women demographic mismatch penalty (-40)");
    }
  } else if (intent.demographic === 'kids') {
    if (isKidsProduct) {
      score += 80;
      matchReasons.push("Kids/Baby demographic alignment (+80)");
    } else {
      score -= 30;
      matchReasons.push("Adult demographic on kids query penalty (-30)");
    }
  }

  // 5. Stock & Rating Bonus
  if (product.stock && product.stock > 0) score += 5;
  if (product.stars) score += parseFloat(product.stars);

  return { product, score, price, matchReasons };
}

/**
 * 4. SCORE, RANK AND FILTER PRODUCTS
 */
export function rankAndFilterProducts(products: any[], query: string): any[] {
  if (!products || products.length === 0) return [];
  const intent = extractSemanticIntent(query);

  const scoredList: ScoredProduct[] = products
    .map(p => scoreProduct(p, intent))
    .filter(sp => sp.score > 0);

  scoredList.sort((a, b) => b.score - a.score);

  return scoredList.map(sp => sp.product);
}
