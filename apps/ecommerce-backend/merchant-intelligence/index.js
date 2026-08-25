"use strict";
/**
 * ⚡ Merchant Intelligence Analytical Services
 *
 * Reusable, strictly read-only analytics functions querying PostgreSQL.
 * Securely isolated from customer-side Shopi AI and public shopping routes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBusinessAlerts = exports.getCancellationAnalytics = exports.getReturnAnalytics = exports.getRepeatCustomers = exports.getCustomerSummary = exports.getInventoryVelocity = exports.getLowStockProducts = exports.getProductDetails = exports.getCategoryPerformance = exports.getWorstPerformingProducts = exports.getTopProducts = exports.getWeekOverWeekComparison = exports.getMonthOverMonthComparison = exports.getSalesTrend = exports.getRevenueSummary = void 0;
var revenue_analytics_1 = require("./revenue-analytics");
Object.defineProperty(exports, "getRevenueSummary", { enumerable: true, get: function () { return revenue_analytics_1.getRevenueSummary; } });
Object.defineProperty(exports, "getSalesTrend", { enumerable: true, get: function () { return revenue_analytics_1.getSalesTrend; } });
Object.defineProperty(exports, "getMonthOverMonthComparison", { enumerable: true, get: function () { return revenue_analytics_1.getMonthOverMonthComparison; } });
Object.defineProperty(exports, "getWeekOverWeekComparison", { enumerable: true, get: function () { return revenue_analytics_1.getWeekOverWeekComparison; } });
var product_analytics_1 = require("./product-analytics");
Object.defineProperty(exports, "getTopProducts", { enumerable: true, get: function () { return product_analytics_1.getTopProducts; } });
Object.defineProperty(exports, "getWorstPerformingProducts", { enumerable: true, get: function () { return product_analytics_1.getWorstPerformingProducts; } });
Object.defineProperty(exports, "getCategoryPerformance", { enumerable: true, get: function () { return product_analytics_1.getCategoryPerformance; } });
Object.defineProperty(exports, "getProductDetails", { enumerable: true, get: function () { return product_analytics_1.getProductDetails; } });
var inventory_analytics_1 = require("./inventory-analytics");
Object.defineProperty(exports, "getLowStockProducts", { enumerable: true, get: function () { return inventory_analytics_1.getLowStockProducts; } });
Object.defineProperty(exports, "getInventoryVelocity", { enumerable: true, get: function () { return inventory_analytics_1.getInventoryVelocity; } });
var customer_analytics_1 = require("./customer-analytics");
Object.defineProperty(exports, "getCustomerSummary", { enumerable: true, get: function () { return customer_analytics_1.getCustomerSummary; } });
Object.defineProperty(exports, "getRepeatCustomers", { enumerable: true, get: function () { return customer_analytics_1.getRepeatCustomers; } });
var return_analytics_1 = require("./return-analytics");
Object.defineProperty(exports, "getReturnAnalytics", { enumerable: true, get: function () { return return_analytics_1.getReturnAnalytics; } });
Object.defineProperty(exports, "getCancellationAnalytics", { enumerable: true, get: function () { return return_analytics_1.getCancellationAnalytics; } });
var alerts_engine_1 = require("./alerts-engine");
Object.defineProperty(exports, "getBusinessAlerts", { enumerable: true, get: function () { return alerts_engine_1.getBusinessAlerts; } });
