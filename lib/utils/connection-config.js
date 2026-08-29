"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.capabilitiesToMode = capabilitiesToMode;
exports.parseConnectionConfig = parseConnectionConfig;
exports.normalizeServerConnectionConfig = normalizeServerConnectionConfig;
exports.resolveServerWsCapabilities = resolveServerWsCapabilities;
function modeToCapabilities(mode) {
    return mode === 'forward'
        ? { accept_inbound_ws: true, dial_outbound_ws: false }
        : { accept_inbound_ws: false, dial_outbound_ws: true };
}
function capabilitiesToMode(caps) {
    return caps.accept_inbound_ws ? 'forward' : 'reverse';
}
function validateWsCapabilities(caps) {
    if (caps.accept_inbound_ws && caps.dial_outbound_ws) {
        throw new Error('配置冲突：accept_inbound_ws 与 dial_outbound_ws 不能同时为 true。\n' +
            '修复建议：二选一。常见场景建议使用 accept_inbound_ws=true, dial_outbound_ws=false。');
    }
    if (!caps.accept_inbound_ws && !caps.dial_outbound_ws) {
        throw new Error('配置无效：accept_inbound_ws 与 dial_outbound_ws 不能同时为 false。\n' +
            '修复建议：至少启用一种能力。常见场景建议使用 accept_inbound_ws=true。');
    }
}
function parseConnectionConfig(server) {
    if (typeof server?.connection_config === 'string' && server.connection_config.trim()) {
        try {
            const parsed = JSON.parse(server.connection_config);
            return parsed && typeof parsed === 'object' ? parsed : {};
        }
        catch {
            return {};
        }
    }
    if (server?.connection_config && typeof server.connection_config === 'object') {
        return server.connection_config;
    }
    return {};
}
function normalizeServerConnectionConfig(rawConfig, legacyMode) {
    const parsedConfig = rawConfig || {};
    const wsCapabilities = parsedConfig.ws_capabilities || {};
    const fromCapabilities = {
        accept_inbound_ws: wsCapabilities.accept_inbound_ws ?? parsedConfig.accept_inbound_ws,
        dial_outbound_ws: wsCapabilities.dial_outbound_ws ?? parsedConfig.dial_outbound_ws,
    };
    const hasNewFields = typeof fromCapabilities.accept_inbound_ws === 'boolean' ||
        typeof fromCapabilities.dial_outbound_ws === 'boolean';
    const capabilities = hasNewFields
        ? {
            accept_inbound_ws: Boolean(fromCapabilities.accept_inbound_ws),
            dial_outbound_ws: Boolean(fromCapabilities.dial_outbound_ws),
        }
        : legacyMode
            ? modeToCapabilities(legacyMode)
            : { accept_inbound_ws: true, dial_outbound_ws: false };
    validateWsCapabilities(capabilities);
    const mappedMode = capabilitiesToMode(capabilities);
    if (legacyMode && mappedMode !== legacyMode) {
        throw new Error(`配置冲突：legacy connection_mode=${legacyMode} 与能力字段不一致（映射为 ${mappedMode}）。\n` +
            '修复建议：删除 legacy connection_mode，仅保留 accept_inbound_ws / dial_outbound_ws。');
    }
    return {
        capabilities,
        mappedMode,
        usedLegacyMode: !hasNewFields && Boolean(legacyMode),
        connectionConfig: {
            ...parsedConfig,
            ws_capabilities: capabilities,
        },
    };
}
function resolveServerWsCapabilities(server) {
    const normalized = normalizeServerConnectionConfig(parseConnectionConfig(server), server?.connection_mode === 'forward' || server?.connection_mode === 'reverse'
        ? server.connection_mode
        : undefined);
    return normalized.capabilities;
}
