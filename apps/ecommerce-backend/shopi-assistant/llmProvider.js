/**
 * LLM Provider Abstraction & Conversational Guardrails (Phase 12 & 13)
 *
 * Implements decoupled provider generation:
 *   generate(prompt, context, options) -> String
 *
 * Supported Providers:
 *   1. 'groq'     : Groq Cloud API (Llama 3.3 70B / 8B)
 *   2. 'gemini'   : Google Gemini Flash
 *   3. 'openai'   : OpenAI GPT-4o-mini
 *   4. 'templated': High-quality deterministic salesperson conversational generator
 *
 * Enforces all 13 strict anti-hallucination guardrails.
 */

const SYSTEM_GUARDRAILS = `You are "Shopi", an intelligent, helpful, and concise customer-side AI shopping salesperson for a modern ecommerce store.

STRICT OPERATIONAL RULES & GUARDRAILS:
1. NEVER invent products, SKUs, or brands not provided in the verified context.
2. NEVER invent or guess prices, discounts, or currencies.
3. NEVER invent availability, sizes, or colors.
4. NEVER invent customer reviews, sentiments, or star ratings.
5. NEVER invent physical attributes (materials, fits, closures) if they are missing or null.
6. NEVER override or ignore hard customer constraints (e.g. price limits, sizes, colors).
7. NEVER claim an exact match exists when retrieval says NO_EXACT_MATCH.
8. NEVER silently relax constraints. If relaxing, explicitly inform the user.
9. Ground all answers strictly in the verified product data provided in context.
10. Ask concise clarification questions ONLY when the customer request is genuinely ambiguous.
11. Keep answers conversational, crisp, friendly, and focused on helping the customer make a great purchase decision.
12. Always format prices in INR (₹).
13. If product information is missing or null, honestly acknowledge it rather than guessing.`;

// Load environment variables
function getApiKey(keyName) {
  return process.env[keyName] || null;
}

// Remote Groq API
async function groqGenerate(systemPrompt, userPrompt, apiKey, model = 'llama-3.3-70b-versatile') {
  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 600
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API Error [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim();
}

// Remote Gemini API
async function geminiGenerate(systemPrompt, userPrompt, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }
      ],
      generationConfig: { temperature: 0.2, maxOutputTokens: 600 }
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API Error [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.candidates[0]?.content?.parts[0]?.text?.trim();
}

// Remote OpenAI API
async function openaiGenerate(systemPrompt, userPrompt, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 600
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API Error [${res.status}]: ${err}`);
  }
  const data = await res.json();
  return data.choices[0]?.message?.content?.trim();
}

/**
 * Deterministic Salesperson Generator (Zero-hallucination baseline)
 */
function deterministicGenerate(intent, data) {
  if (data.match_status === 'NO_EXACT_MATCH') {
    let msg = `I couldn't find an exact match for your request.`;
    if (data.relaxed_alternatives && data.relaxed_alternatives.length > 0) {
      msg += `\n\nHere are the closest alternatives if you'd like to consider:`;
    }
    return msg;
  }

  if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_REFINEMENT' || intent === 'PRODUCT_RECOMMENDATION') {
    const count = data.products?.length || 0;
    if (count === 0) return `I couldn't find any products matching those criteria.`;
    return `I found ${count} option${count > 1 ? 's' : ''} matching your preferences:`;
  }

  if (intent === 'PRODUCT_DETAILS') {
    const p = data.product;
    if (!p) return `I couldn't find the details for that product.`;
    return `Here are the verified details for **${p.title}**:`;
  }

  if (intent === 'REVIEW_QUERY') {
    const r = data.reviews;
    if (!r || !r.has_reviews) return `I don't have enough customer review data for this product.`;
    return `Here is what customers say about this product:`;
  }

  if (intent === 'PRODUCT_COMPARISON') {
    return data.comparison?.recommendation_summary || `Here is a side-by-side comparison of your selected options:`;
  }

  if (intent === 'GENERAL_SHOPPING') {
    return `Hello! I'm Shopi, your AI shopping assistant. I can help you find running shoes, casual shirts, jeans, sneakers, dresses, jackets, backpacks, and more. What are you looking for today?`;
  }

  return `How can I help you with your shopping today?`;
}

/**
 * Master LLM Generate Function
 */
async function generateResponse(promptData, options = {}) {
  const provider = options.provider || process.env.SHOPI_LLM_PROVIDER || (
    getApiKey('GROQ_API_KEY') ? 'groq' :
    (getApiKey('GEMINI_API_KEY') ? 'gemini' :
    (getApiKey('OPENAI_API_KEY') ? 'openai' : 'templated'))
  );

  const systemPrompt = SYSTEM_GUARDRAILS;
  const userPrompt = typeof promptData === 'string' ? promptData : JSON.stringify(promptData, null, 2);

  try {
    if (provider === 'groq' && getApiKey('GROQ_API_KEY')) {
      return await groqGenerate(systemPrompt, userPrompt, getApiKey('GROQ_API_KEY'));
    }
    if (provider === 'gemini' && getApiKey('GEMINI_API_KEY')) {
      return await geminiGenerate(systemPrompt, userPrompt, getApiKey('GEMINI_API_KEY'));
    }
    if (provider === 'openai' && getApiKey('OPENAI_API_KEY')) {
      return await openaiGenerate(systemPrompt, userPrompt, getApiKey('OPENAI_API_KEY'));
    }
  } catch (err) {
    console.warn(`[LLM Provider '${provider}' failed, falling back to deterministic template]:`, err.message);
  }

  return deterministicGenerate(options.intent || 'PRODUCT_SEARCH', promptData);
}

module.exports = {
  generateResponse,
  deterministicGenerate,
  SYSTEM_GUARDRAILS
};
