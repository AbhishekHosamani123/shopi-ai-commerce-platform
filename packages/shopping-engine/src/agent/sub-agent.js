"use strict";
/**
 * Sub-agent primitive — invoke a child ShoppingAgent from inside a parent
 * run with tracer/onLog wrapped to inject `parent_span_id` + `sub_agent_name`
 * on every child span and log event. The Cloud trace explorer reads these
 * attributes to render the multi-agent run as a tree.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SUB_AGENT_MAX_DEPTH = void 0;
exports.runSubAgent = runSubAgent;
const node_crypto_1 = require("node:crypto");
exports.DEFAULT_SUB_AGENT_MAX_DEPTH = 3;
function runSubAgent(opts) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c;
        const parentDepth = (_a = opts.parentDepth) !== null && _a !== void 0 ? _a : 0;
        const childDepth = parentDepth + 1;
        const maxDepth = (_b = opts.maxDepth) !== null && _b !== void 0 ? _b : exports.DEFAULT_SUB_AGENT_MAX_DEPTH;
        if (childDepth > maxDepth) {
            throw new Error(`runSubAgent: depth ${childDepth} exceeds maxDepth ${maxDepth} (recursion guard)`);
        }
        validateInputSchema(opts.subAgent, opts.input);
        const invocationId = (0, node_crypto_1.randomUUID)();
        const wrappedTracer = opts.parentTracer
            ? wrapTracerWithParent(opts.parentTracer, invocationId, opts.subAgent.name)
            : undefined;
        const wrappedOnLog = opts.parentOnLog
            ? wrapOnLogWithParent(opts.parentOnLog, opts.subAgent.name, invocationId)
            : undefined;
        const span = (_c = opts.parentTracer) === null || _c === void 0 ? void 0 : _c.startSpan('agent.sub_agent', {
            sub_agent_name: opts.subAgent.name,
            sub_agent_invocation_id: invocationId,
            depth: childDepth,
        });
        const ctx = {
            tracer: wrappedTracer,
            onLog: wrappedOnLog,
            depth: childDepth,
        };
        try {
            const built = opts.subAgent.build(ctx);
            const runnable = built;
            if (!runnable || typeof runnable.run !== 'function') {
                throw new Error(`SubAgent.build('${opts.subAgent.name}') did not return an object with a run() method`);
            }
            return yield runnable.run(opts.input);
        }
        finally {
            span === null || span === void 0 ? void 0 : span.end();
        }
    });
}
function wrapTracerWithParent(inner, parentSpanId, subAgentName) {
    return {
        startSpan(name, attributes) {
            return inner.startSpan(name, Object.assign(Object.assign({}, attributes), { parent_span_id: parentSpanId, sub_agent_name: subAgentName }));
        },
    };
}
function wrapOnLogWithParent(inner, subAgentName, invocationId) {
    return (event) => {
        inner(Object.assign(Object.assign({}, event), { data: Object.assign(Object.assign({}, event.data), { sub_agent_name: subAgentName, sub_agent_invocation_id: invocationId }) }));
    };
}
function validateInputSchema(subAgent, input) {
    const schema = subAgent.inputSchema;
    if (!schema)
        return;
    if (typeof schema.type === 'string' && schema.type !== 'string') {
        // Only string inputs flow through this helper today; structured inputs
        // round-trip via JSON in the parent LLM's tool-call argument. The chain
        // layer can stringify before calling runSubAgent.
        return;
    }
}
