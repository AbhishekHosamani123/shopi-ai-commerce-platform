import { client } from '../../data/DB';

export interface DecisionHistoryItem {
  actionId: string;
  actionType: string;
  productId: number;
  productName: string;
  quantity?: number;
  status: string;
  reason: string;
  createdAt: string;
  completedAt?: string | null;
}

export class DecisionHistoryService {
  /**
   * Fetches historical approved and rejected decisions to inform recommendation ranking.
   */
  async getDecisionHistory(
    merchantId: string = 'default_merchant',
    limit: number = 20
  ): Promise<DecisionHistoryItem[]> {
    const res = await client.query(`
      SELECT action_id, action_type, product_id, product_name, quantity, status, reason, created_at, completed_at
      FROM merchant_ai_actions
      WHERE (merchant_id = $1 OR $1 = 'merchant_admin')
      ORDER BY created_at DESC
      LIMIT $2;
    `, [merchantId, limit]);

    return res.rows.map(r => ({
      actionId: r.action_id,
      actionType: r.action_type,
      productId: r.product_id,
      productName: r.product_name,
      quantity: r.quantity,
      status: r.status,
      reason: r.reason,
      createdAt: new Date(r.created_at).toISOString(),
      completedAt: r.completed_at ? new Date(r.completed_at).toISOString() : null
    }));
  }
}

export const decisionHistoryService = new DecisionHistoryService();
