/**
 * ⚡ ConversationalStateManager.ts
 * 
 * Persistent, in-memory conversational session store for Shopi AI.
 * Tracks canonical product identities, recommendation result sets,
 * search filters, last added products, and cart actions across multi-turn dialogues.
 */

import { RealCartState, RealCartItem } from './RazorpayCommerceAdapter';

export interface CanonicalProduct {
  id?: string;
  productId: string;
  title: string;
  name: string;
  price: number;
  currency: string;
  category?: string;
  imageUrl: string;
  inStock?: boolean;
  stars?: number;
  rating?: number;
  description?: string;
}

export interface ConversationFilters {
  category?: string | null;
  demographic?: 'men' | 'women' | 'kids' | 'unspecified';
  maxPrice?: number | null;
  minPrice?: number | null;
  exactPrice?: number | null;
  color?: string | null;
  keywords?: string[];
  sort?: 'price_asc' | 'price_desc' | 'rating_desc' | 'relevance';
}

export interface ConversationState {
  conversationId: string;
  userId?: number;
  lastUserIntent?: string;
  lastSearchQuery?: string;
  lastSearchFilters?: ConversationFilters;
  lastRecommendedProducts: CanonicalProduct[];
  lastViewedProduct?: CanonicalProduct;
  lastMentionedProducts: CanonicalProduct[];
  lastAddedProducts: CanonicalProduct[];
  lastComparedProducts: CanonicalProduct[];
  lastActiveProduct?: CanonicalProduct;
  lastCartAction?: {
    action: 'add' | 'remove' | 'update' | 'clear';
    products: CanonicalProduct[];
    timestamp: number;
  };
  cartState?: RealCartState;
  updatedAt: number;
}

class ConversationalStateManager {
  private sessions = new Map<string, ConversationState>();
  private readonly TTL_MS = 30 * 60 * 1000; // 30-minute session TTL

  /**
   * Derives a stable session key from conversationId or userId
   */
  getSessionKey(conversationId?: string, userId?: number): string {
    if (conversationId && typeof conversationId === 'string' && conversationId.trim().length > 0) {
      return conversationId.trim();
    }
    if (userId) {
      return `user_${userId}`;
    }
    return 'default_session';
  }

  /**
   * Retrieves conversation state for the active session, initializing a blank state if none exists
   */
  getState(conversationId?: string, userId?: number): ConversationState {
    const key = this.getSessionKey(conversationId, userId);
    let state = this.sessions.get(key);

    if (!state || (Date.now() - state.updatedAt > this.TTL_MS)) {
      state = {
        conversationId: key,
        userId,
        lastRecommendedProducts: [],
        lastMentionedProducts: [],
        lastAddedProducts: [],
        lastComparedProducts: [],
        updatedAt: Date.now(),
      };
      this.sessions.set(key, state);
    }

    return state;
  }

  /**
   * Atomically updates the conversation state for a session
   */
  updateState(
    conversationId: string | undefined,
    userId: number | undefined,
    updates: Partial<ConversationState>
  ): ConversationState {
    const key = this.getSessionKey(conversationId, userId);
    const existing = this.getState(conversationId, userId);

    const merged: ConversationState = {
      ...existing,
      ...updates,
      conversationId: key,
      userId: userId || existing.userId,
      updatedAt: Date.now(),
    };

    this.sessions.set(key, merged);
    return merged;
  }

  /**
   * Cleans up expired sessions
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, session] of this.sessions.entries()) {
      if (now - session.updatedAt > this.TTL_MS) {
        this.sessions.delete(key);
      }
    }
  }

  /**
   * Debugging: Dump current active sessions (dev only)
   */
  dumpState(conversationId?: string, userId?: number): ConversationState | undefined {
    const key = this.getSessionKey(conversationId, userId);
    return this.sessions.get(key);
  }
}

export const conversationManager = new ConversationalStateManager();
