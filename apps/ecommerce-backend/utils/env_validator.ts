/**
 * 🔒 Phase 10: Production Environment & Secret Validation Utility
 */

export interface EnvValidationResult {
  isValid: boolean;
  environment: 'development' | 'staging' | 'production';
  missingVariables: string[];
  warnings: string[];
  redactedKeys: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const env = (process.env.NODE_ENV || 'development').toLowerCase() as 'development' | 'staging' | 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  // Critical Database & Server Credentials
  const requiredInProd = [
    'DATABASE_URL',
    'PGHOST',
    'PGUSER',
    'PGDATABASE',
    'API_SECRET',
    'GROQ_API_KEY'
  ];

  if (env === 'production') {
    for (const key of requiredInProd) {
      if (!process.env[key] && !process.env.DATABASE_URL) {
        missing.push(key);
      }
    }

    if (process.env.API_SECRET === 'razorpay_ai_commerce_shared_secret_2026') {
      warnings.push('CRITICAL: Default development API_SECRET detected in production configuration.');
    }
  } else {
    // Development / Test warning checks
    if (!process.env.GROQ_API_KEY) {
      warnings.push('NOTICE: GROQ_API_KEY not set; AI Copilot will use local heuristic fallback engine.');
    }
  }

  const sensitiveKeys = [
    'PGPASSWORD',
    'DATABASE_URL',
    'API_SECRET',
    'GROQ_API_KEY',
    'RAZORPAY_KEY_SECRET',
    'JWT_SECRET',
    'SECRET_KEY'
  ];

  return {
    isValid: missing.length === 0,
    environment: env,
    missingVariables: missing,
    warnings,
    redactedKeys: sensitiveKeys
  };
}

/**
 * Sanitizes any object or string to remove sensitive tokens before logging or rendering
 */
export function sanitizeLogOutput(obj: any): any {
  if (typeof obj === 'string') {
    let sanitized = obj;
    const sensitiveTokens = [
      process.env.API_SECRET,
      process.env.PGPASSWORD,
      process.env.GROQ_API_KEY,
      process.env.RAZORPAY_KEY_SECRET
    ].filter(Boolean) as string[];

    for (const token of sensitiveTokens) {
      if (token && token.length > 4) {
        sanitized = sanitized.split(token).join('***REDACTED***');
      }
    }
    return sanitized;
  }

  if (obj && typeof obj === 'object') {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeLogOutput);
    }
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (
        lower.includes('secret') ||
        lower.includes('password') ||
        lower.includes('token') ||
        lower.includes('key') ||
        lower.includes('authorization')
      ) {
        clean[k] = '***REDACTED***';
      } else {
        clean[k] = sanitizeLogOutput(v);
      }
    }
    return clean;
  }

  return obj;
}
