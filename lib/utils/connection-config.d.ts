export interface WsCapabilities {
    accept_inbound_ws: boolean;
    dial_outbound_ws: boolean;
}
export declare function capabilitiesToMode(caps: WsCapabilities): 'forward' | 'reverse';
export declare function parseConnectionConfig(server: any): Record<string, any>;
export declare function normalizeServerConnectionConfig(rawConfig: Record<string, any> | undefined, legacyMode?: 'forward' | 'reverse'): {
    capabilities: WsCapabilities;
    connectionConfig: Record<string, any>;
    mappedMode: 'forward' | 'reverse';
    usedLegacyMode: boolean;
};
export declare function resolveServerWsCapabilities(server: any): WsCapabilities;
