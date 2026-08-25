"use strict";
/**
 * ⚡ ConversationalStateManager.ts
 *
 * Persistent, in-memory conversational session store for Shopi AI.
 * Tracks canonical product identities, recommendation result sets,
 * search filters, last added products, and cart actions across multi-turn dialogues.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.conversationManager = void 0;
class ConversationalStateManager {
    constructor() {
        this.sessions = new Map();
        this.TTL_MS = 30 * 60 * 1000; // 30-minute session TTL
    }
    /**
     * Derives a stable session key from conversationId or userId
     */
    getSessionKey(conversationId, userId) {
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
    getState(conversationId, userId) {
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
    updateState(conversationId, userId, updates) {
        const key = this.getSessionKey(conversationId, userId);
        const existing = this.getState(conversationId, userId);
        const merged = Object.assign(Object.assign(Object.assign({}, existing), updates), { conversationId: key, userId: userId || existing.userId, updatedAt: Date.now() });
        this.sessions.set(key, merged);
        return merged;
    }
    /**
     * Cleans up expired sessions
     */
    cleanup() {
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
    dumpState(conversationId, userId) {
        const key = this.getSessionKey(conversationId, userId);
        return this.sessions.get(key);
    }
}
exports.conversationManager = new ConversationalStateManager();
