"use strict";
/**
 * ⚡ Shipping & Inter-Warehouse Transfer Cost Engine (Phase 6)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDistanceKm = calculateDistanceKm;
exports.estimateShippingCost = estimateShippingCost;
function calculateDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2)
        return 500; // Default fallback distance (500km)
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}
function estimateShippingCost(originLat, originLon, destLat, destLon, totalUnits = 1) {
    const distanceKm = calculateDistanceKm(originLat, originLon, destLat, destLon);
    const baseCost = 60; // Base dispatch charge in INR
    const perKmRate = 0.08; // ₹0.08 per km per package unit
    const variableCost = distanceKm * perKmRate * Math.max(1, Math.ceil(totalUnits / 5));
    const estimatedCost = Math.round(baseCost + variableCost);
    // Transit days estimate: ~300km per day + 1 day handling
    const transitDaysEstimate = Math.max(1, Math.min(5, Math.ceil(distanceKm / 400) + 1));
    return {
        estimatedCost,
        baseCost,
        perKmRate,
        distanceKm,
        isEstimated: true,
        transitDaysEstimate,
        notes: 'Estimated shipping cost based on geospatial distance heuristics. Real carrier API not configured.'
    };
}
