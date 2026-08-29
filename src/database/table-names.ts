/**
 * Mochi-Link (大福连) - Table Name Manager
 * 
 * Centralized table name management with prefix support
 */

export function normalizeTablePrefix(prefix: string = 'mochi'): string {
  return prefix.trim().replace(/[._]+$/g, '');
}

export function buildTableName(prefix: string | undefined, baseName: string): string {
  const normalizedPrefix = normalizeTablePrefix(prefix || '');
  return normalizedPrefix ? `${normalizedPrefix}_${baseName}` : baseName;
}

export class TableNames {
  private static prefix: string = 'mochi';

  /**
   * Initialize table name prefix
   */
  static initialize(prefix: string = 'mochi'): void {
    this.prefix = normalizeTablePrefix(prefix);
  }

  /**
   * Get table name with prefix
   */
  private static getTableName(baseName: string): string {
    return buildTableName(this.prefix, baseName);
  }

  // Table name getters
  static get servers(): string {
    return this.getTableName('servers');
  }

  static get serverAcl(): string {
    return this.getTableName('server_acl');
  }

  static get apiTokens(): string {
    return this.getTableName('api_tokens');
  }

  static get auditLogs(): string {
    return this.getTableName('audit_logs');
  }

  static get groupBindings(): string {
    return this.getTableName('group_bindings');
  }

  static get pendingOperations(): string {
    return this.getTableName('pending_operations');
  }

  static get playerCache(): string {
    return this.getTableName('player_cache');
  }

  static get serverBindings(): string {
    return this.getTableName('server_bindings');
  }

  // Alias methods for backward compatibility
  static get minecraftServers(): string {
    return this.servers;
  }

  static get serverAcl_alias(): string {
    return this.serverAcl;
  }

  static get apiTokens_alias(): string {
    return this.apiTokens;
  }

  static get auditLogs_alias(): string {
    return this.auditLogs;
  }

  static get pendingOperations_alias(): string {
    return this.pendingOperations;
  }

  static get playerCache_alias(): string {
    return this.playerCache;
  }

  static get serverBindings_alias(): string {
    return this.serverBindings;
  }
}
