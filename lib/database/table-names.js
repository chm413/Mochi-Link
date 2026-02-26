"use strict";
/**
 * Mochi-Link (大福连) - Table Name Manager
 *
 * Centralized table name management with prefix support
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableNames = void 0;
class TableNames {
    /**
     * Initialize table name prefix
     */
    static initialize(prefix) {
        if (prefix) {
            this.prefix = prefix.replace(/\.$/, '').replace(/_$/, '');
        }
    }
    /**
     * Get table name with prefix
     */
    static getTableName(baseName) {
        if (!this.prefix || this.prefix === '') {
            return baseName;
        }
        return `${this.prefix}_${baseName}`;
    }
    // Table name getters
    static get servers() {
        return this.getTableName('servers');
    }
    static get serverAcl() {
        return this.getTableName('server_acl');
    }
    static get apiTokens() {
        return this.getTableName('api_tokens');
    }
    static get auditLogs() {
        return this.getTableName('audit_logs');
    }
    static get groupBindings() {
        return this.getTableName('group_bindings');
    }
    static get pendingOperations() {
        return this.getTableName('pending_operations');
    }
    static get playerCache() {
        return this.getTableName('player_cache');
    }
    static get serverBindings() {
        return this.getTableName('server_bindings');
    }
    // Alias methods for backward compatibility
    static get minecraftServers() {
        return this.servers;
    }
    static get serverAcl_alias() {
        return this.serverAcl;
    }
    static get apiTokens_alias() {
        return this.apiTokens;
    }
    static get auditLogs_alias() {
        return this.auditLogs;
    }
    static get pendingOperations_alias() {
        return this.pendingOperations;
    }
    static get playerCache_alias() {
        return this.playerCache;
    }
    static get serverBindings_alias() {
        return this.serverBindings;
    }
}
exports.TableNames = TableNames;
TableNames.prefix = 'mochi';
