"use strict";
/**
 * 📅 Merchant AI Period Resolver
 *
 * Normalizes natural language temporal expressions into standardized date windows,
 * SQL day offsets, and human-readable period labels.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolvePeriod = resolvePeriod;
function resolvePeriod(query = '', fallbackPeriod = 'last_30_days') {
    const normalized = query.toLowerCase().trim();
    const now = new Date();
    // Helper to format YYYY-MM-DD
    const toDateStr = (d) => d.toISOString().split('T')[0];
    // 1. Exact match / standard phrases
    if (/\b(today|1d)\b/.test(normalized)) {
        return {
            periodKey: 'today',
            label: 'Today',
            days: 1,
            startDate: toDateStr(now),
            endDate: toDateStr(now)
        };
    }
    if (/\b(yesterday)\b/.test(normalized)) {
        const yesterday = new Date(now.getTime() - 86400000);
        return {
            periodKey: 'yesterday',
            label: 'Yesterday',
            days: 1,
            startDate: toDateStr(yesterday),
            endDate: toDateStr(yesterday)
        };
    }
    if (/\b(this week|current week)\b/.test(normalized)) {
        const start = new Date(now.getTime() - 7 * 86400000);
        return {
            periodKey: 'last_7_days',
            label: 'This Week (Last 7 Days)',
            days: 7,
            startDate: toDateStr(start),
            endDate: toDateStr(now)
        };
    }
    if (/\b(last week|past week|7 days|7d|last 7 days)\b/.test(normalized)) {
        const start = new Date(now.getTime() - 7 * 86400000);
        return {
            periodKey: 'last_7_days',
            label: 'Last 7 Days',
            days: 7,
            startDate: toDateStr(start),
            endDate: toDateStr(now)
        };
    }
    if (/\b(this month|current month)\b/.test(normalized)) {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const dayDiff = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86400000));
        return {
            periodKey: 'last_30_days',
            label: 'This Month (Current Month MTD)',
            days: Math.max(dayDiff, 30),
            startDate: toDateStr(start),
            endDate: toDateStr(now)
        };
    }
    if (/\b(last month|past month)\b/.test(normalized)) {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return {
            periodKey: 'last_30_days',
            label: 'Last Month',
            days: 30,
            startDate: toDateStr(start),
            endDate: toDateStr(end)
        };
    }
    if (/\b(90 days|90d|last 90 days|quarter|this quarter|last quarter)\b/.test(normalized)) {
        const start = new Date(now.getTime() - 90 * 86400000);
        return {
            periodKey: 'last_90_days',
            label: 'Last 90 Days',
            days: 90,
            startDate: toDateStr(start),
            endDate: toDateStr(now)
        };
    }
    if (/\b(this year|last year|12 months|12m|last 12 months|all time|yearly|overall)\b/.test(normalized)) {
        const start = new Date(now.getTime() - 365 * 86400000);
        return {
            periodKey: 'last_12_months',
            label: 'Last 12 Months',
            days: 365,
            startDate: toDateStr(start),
            endDate: toDateStr(now)
        };
    }
    // 2. Specific Month Matching (e.g. "in July", "in August", "in December")
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let i = 0; i < months.length; i++) {
        const m = months[i];
        if (new RegExp(`\\b(${m}|${m.slice(0, 3)})\\b`).test(normalized)) {
            const year = now.getFullYear();
            const start = new Date(year, i, 1);
            const end = new Date(year, i + 1, 0);
            return {
                periodKey: 'last_30_days',
                label: `${m.charAt(0).toUpperCase() + m.slice(1)} ${year}`,
                days: 30,
                startDate: toDateStr(start),
                endDate: toDateStr(end),
                isCustomRange: true
            };
        }
    }
    // 3. Default fallback
    const start = new Date(now.getTime() - 30 * 86400000);
    return {
        periodKey: fallbackPeriod,
        label: fallbackPeriod === 'last_12_months' ? 'Last 12 Months' : fallbackPeriod === 'last_7_days' ? 'Last 7 Days' : 'Last 30 Days',
        days: fallbackPeriod === 'last_12_months' ? 365 : fallbackPeriod === 'last_7_days' ? 7 : 30,
        startDate: toDateStr(start),
        endDate: toDateStr(now)
    };
}
