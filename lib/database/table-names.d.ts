/**
 * Mochi-Link (大福连) - Table Name Manager
 *
 * Centralized table name management with prefix support
 */
export declare class TableNames {
    private static prefix;
    /**
     * Initialize table name prefix
     */
    static initialize(prefix?: string): void;
    /**
     * Get table name with prefix
     */
    private static getTableName;
    static get servers(): string;
    static get serverAcl(): string;
    static get apiTokens(): string;
    static get auditLogs(): string;
    static get groupBindings(): string;
    static get pendingOperations(): string;
    static get playerCache(): string;
    static get serverBindings(): string;
    static get minecraftServers(): string;
    static get serverAcl_alias(): string;
    static get apiTokens_alias(): string;
    static get auditLogs_alias(): string;
    static get pendingOperations_alias(): string;
    static get playerCache_alias(): string;
    static get serverBindings_alias(): string;
}
