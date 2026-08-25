"use strict";
/**
 * @ucptools/agent-sdk - Type Definitions
 *
 * Core types for building AI shopping agents on UCP.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEnterprisePlugin = isEnterprisePlugin;
function isEnterprisePlugin(plugin) {
    return 'onBeforeToolCall' in plugin
        || 'onAfterToolCall' in plugin
        || 'onRegister' in plugin
        || 'onInit' in plugin
        || 'manifest' in plugin
        || 'configure' in plugin
        || 'getState' in plugin;
}
