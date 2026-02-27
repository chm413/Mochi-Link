/**
 * Database JSON Field Repair Utility
 * 
 * This script fixes invalid JSON data in database text fields that should contain JSON.
 * It handles empty strings, malformed JSON, and null values.
 */

import { Context } from 'koishi';
import { TableNames } from './table-names';

export async function fixInvalidJsonFields(ctx: Context): Promise<{
  serversFixed: number;
  aclsFixed: number;
  tokensFixed: number;
  auditsFixed: number;
  operationsFixed: number;
}> {
  const logger = ctx.logger('mochi-link:db-fix');
  const results = {
    serversFixed: 0,
    aclsFixed: 0,
    tokensFixed: 0,
    auditsFixed: 0,
    operationsFixed: 0
  };

  logger.info('Starting database JSON field repair...');

  // Fix minecraft_servers table
  try {
    const servers = await ctx.database.get(TableNames.minecraftServers as any, {});
    for (const server of servers) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix connection_config
      if (server.connection_config === '' || server.connection_config === null) {
        updates.connection_config = '{}';
        needsUpdate = true;
      } else if (typeof server.connection_config === 'string') {
        try {
          JSON.parse(server.connection_config);
        } catch {
          logger.warn(`Invalid connection_config for server ${server.id}, resetting to {}`);
          updates.connection_config = '{}';
          needsUpdate = true;
        }
      }

      // Fix tags
      if (server.tags === '' || server.tags === null) {
        updates.tags = '[]';
        needsUpdate = true;
      } else if (typeof server.tags === 'string') {
        try {
          JSON.parse(server.tags);
        } catch {
          logger.warn(`Invalid tags for server ${server.id}, resetting to []`);
          updates.tags = '[]';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await ctx.database.set(TableNames.minecraftServers as any, { id: server.id }, updates);
        results.serversFixed++;
      }
    }
    logger.info(`Fixed ${results.serversFixed} server records`);
  } catch (error) {
    logger.error('Error fixing servers table:', error);
  }

  // Fix server_acl table
  try {
    const acls = await ctx.database.get(TableNames.serverAcl as any, {});
    for (const acl of acls) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix permissions
      if (acl.permissions === '' || acl.permissions === null) {
        updates.permissions = '[]';
        needsUpdate = true;
      } else if (typeof acl.permissions === 'string') {
        try {
          JSON.parse(acl.permissions);
        } catch {
          logger.warn(`Invalid permissions for ACL ${acl.id}, resetting to []`);
          updates.permissions = '[]';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await ctx.database.set(TableNames.serverAcl as any, { id: acl.id }, updates);
        results.aclsFixed++;
      }
    }
    logger.info(`Fixed ${results.aclsFixed} ACL records`);
  } catch (error) {
    logger.error('Error fixing ACL table:', error);
  }

  // Fix api_tokens table
  try {
    const tokens = await ctx.database.get(TableNames.apiTokens as any, {});
    for (const token of tokens) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix ip_whitelist
      if (token.ip_whitelist === '') {
        updates.ip_whitelist = null;
        needsUpdate = true;
      } else if (token.ip_whitelist && typeof token.ip_whitelist === 'string') {
        try {
          JSON.parse(token.ip_whitelist);
        } catch {
          logger.warn(`Invalid ip_whitelist for token ${token.id}, resetting to null`);
          updates.ip_whitelist = null;
          needsUpdate = true;
        }
      }

      // Fix encryption_config
      if (token.encryption_config === '') {
        updates.encryption_config = null;
        needsUpdate = true;
      } else if (token.encryption_config && typeof token.encryption_config === 'string') {
        try {
          JSON.parse(token.encryption_config);
        } catch {
          logger.warn(`Invalid encryption_config for token ${token.id}, resetting to null`);
          updates.encryption_config = null;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await ctx.database.set(TableNames.apiTokens as any, { id: token.id }, updates);
        results.tokensFixed++;
      }
    }
    logger.info(`Fixed ${results.tokensFixed} token records`);
  } catch (error) {
    logger.error('Error fixing tokens table:', error);
  }

  // Fix audit_logs table
  try {
    const audits = await ctx.database.get(TableNames.auditLogs as any, {});
    for (const audit of audits) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix operation_data
      if (audit.operation_data === '' || audit.operation_data === null) {
        updates.operation_data = '{}';
        needsUpdate = true;
      } else if (typeof audit.operation_data === 'string') {
        try {
          JSON.parse(audit.operation_data);
        } catch {
          logger.warn(`Invalid operation_data for audit ${audit.id}, resetting to {}`);
          updates.operation_data = '{}';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await ctx.database.set(TableNames.auditLogs as any, { id: audit.id }, updates);
        results.auditsFixed++;
      }
    }
    logger.info(`Fixed ${results.auditsFixed} audit log records`);
  } catch (error) {
    logger.error('Error fixing audit logs table:', error);
  }

  // Fix pending_operations table
  try {
    const operations = await ctx.database.get(TableNames.pendingOperations as any, {});
    for (const operation of operations) {
      let needsUpdate = false;
      const updates: any = {};

      // Fix parameters
      if (operation.parameters === '' || operation.parameters === null) {
        updates.parameters = '{}';
        needsUpdate = true;
      } else if (typeof operation.parameters === 'string') {
        try {
          JSON.parse(operation.parameters);
        } catch {
          logger.warn(`Invalid parameters for operation ${operation.id}, resetting to {}`);
          updates.parameters = '{}';
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        await ctx.database.set(TableNames.pendingOperations as any, { id: operation.id }, updates);
        results.operationsFixed++;
      }
    }
    logger.info(`Fixed ${results.operationsFixed} pending operation records`);
  } catch (error) {
    logger.error('Error fixing pending operations table:', error);
  }

  logger.info('Database JSON field repair completed');
  logger.info(`Total records fixed: ${
    results.serversFixed + 
    results.aclsFixed + 
    results.tokensFixed + 
    results.auditsFixed + 
    results.operationsFixed
  }`);

  return results;
}
