import { Request, Response, NextFunction } from 'express';

export type MerchantRole = 'MERCHANT_ADMIN' | 'MERCHANT_MANAGER' | 'MERCHANT_ANALYST' | 'READ_ONLY';

export interface MerchantContext {
  merchantId: string;
  role: MerchantRole;
}

declare global {
  namespace Express {
    interface Request {
      merchantContext?: MerchantContext;
    }
  }
}

/**
 * Normalizes role string to canonical MerchantRole
 */
export function normalizeMerchantRole(roleHeader?: string | string[]): MerchantRole {
  const r = (Array.isArray(roleHeader) ? roleHeader[0] : roleHeader || '').toUpperCase();
  if (r === 'MERCHANT_ADMIN' || r === 'ADMIN' || r === 'MERCHANT_ADMINISTRATOR') return 'MERCHANT_ADMIN';
  if (r === 'MERCHANT_MANAGER' || r === 'MANAGER' || r === 'OPERATOR') return 'MERCHANT_MANAGER';
  if (r === 'MERCHANT_ANALYST' || r === 'ANALYST') return 'MERCHANT_ANALYST';
  if (r === 'READ_ONLY' || r === 'VIEWER' || r === 'GUEST') return 'READ_ONLY';
  
  // Default to MERCHANT_ADMIN for legacy backward-compatibility in local dev
  return 'MERCHANT_ADMIN';
}

/**
 * Middleware that attaches merchant context and enforces allowed roles
 */
export function requireMerchantRole(allowedRoles: MerchantRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const merchantId = (req.headers['x-merchant-id'] as string) || 'default_merchant';
    const roleHeader = (req.headers['x-merchant-role'] as string) || 'merchant_admin';
    const role = normalizeMerchantRole(roleHeader);

    req.merchantContext = {
      merchantId,
      role
    };

    if (!allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Insufficient Merchant Privileges',
        requiredRoles: allowedRoles,
        currentRole: role,
        message: `Role ${role} cannot perform this action. Required: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}
