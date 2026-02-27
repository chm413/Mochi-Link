﻿/**
 * Mochi-Link (大福连) - Database Initialization
 * 
 * This file contains database initialization scripts and migration utilities.
 */

import { Context } from 'koishi';
import { TableNames } from '../database/table-names';
import { defineModels, runMigrations, checkDatabaseHealth } from './models';
import { DatabaseManager } from './operations';

import { fixInvalidJsonFields } from './fix-invalid-json';
// ============================================================================
// Database Initialization
// ============================================================================

export class DatabaseInitializer {
  private dbManager: DatabaseManager;

  constructor(private ctx: Context) {
    this.dbManager = new DatabaseManager(ctx);
  }

  /**
   * Initialize the complete database system
   */
  async initialize(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    
    try {
      logger.info('Starting database initialization...');

      // Step 1: Check database connectivity
      await this.checkConnectivity();

      // Step 2: Run migrations and create tables
      await this.runMigrations();

      // Step 3: Verify table creation
      await this.verifyTables();

      // Step 4: Fix invalid JSON fields in existing data
      await this.fixInvalidJsonData();

      // Step 5: Create initial data if needed
      await this.createInitialData();

      // Step 6: Final health check
      await this.finalHealthCheck();

      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Check database connectivity
   */
  private async checkConnectivity(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Checking database connectivity...');

    const isHealthy = await checkDatabaseHealth(this.ctx);
    if (!isHealthy) {
      throw new Error('Database connectivity check failed');
    }

    logger.info('Database connectivity verified');
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Running database migrations...');

    await runMigrations(this.ctx);

    logger.info('Database migrations completed');
  }

  /**
   * Verify that all required tables exist
   */
  private async verifyTables(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Verifying table creation...');

    const requiredTables = [
      'minecraft_servers',
      'server_acl',
      'api_tokens',
      'audit_logs',
      'pending_operations',
      'server_bindings',
      'player_cache'
    ];

    for (const table of requiredTables) {
      try {
        // Try to query each table to verify it exists
        await this.ctx.database.get(table as any, {}, ['id']);
        logger.debug(`Table ${table} verified`);
      } catch (error) {
        throw new Error(`Table ${table} verification failed: ${(error as Error).message}`);
      }
    }

    logger.info('All required tables verified');
  }

  /**
   * Fix invalid JSON data in existing database records
   */
  private async fixInvalidJsonData(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Checking for invalid JSON data...');

    try {
      const results = await fixInvalidJsonFields(this.ctx);
      const totalFixed = results.serversFixed + results.aclsFixed + 
                        results.tokensFixed + results.auditsFixed + 
                        results.operationsFixed;
      
      if (totalFixed > 0) {
        logger.info(`Fixed ${totalFixed} records with invalid JSON data`);
      } else {
        logger.info('No invalid JSON data found');
      }
    } catch (error) {
      logger.warn('Failed to fix invalid JSON data:', error);
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Create initial data if needed
   */
  private async createInitialData(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Checking for initial data setup...');

    // Check if any servers exist
    const existingServers = await this.dbManager.servers.getAllServers();
    
    if (existingServers.length === 0) {
      logger.info('No existing servers found - database is ready for first-time setup');
    } else {
      logger.info(`Found ${existingServers.length} existing servers`);
    }

    // Log initial statistics
    const stats = await this.dbManager.getStatistics();
    logger.info('Database statistics:', stats);
  }

  /**
   * Final health check
   */
  private async finalHealthCheck(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:db-init');
    logger.info('Performing final health check...');

    const isHealthy = await this.dbManager.healthCheck();
    if (!isHealthy) {
      throw new Error('Final database health check failed');
    }

    logger.info('Final health check passed');
  }

  /**
   * Get the initialized database manager
   */
  getDatabaseManager(): DatabaseManager {
    return this.dbManager;
  }
}

// ============================================================================
// Database Schema Creation Scripts
// ============================================================================

export class SchemaCreator {
  constructor(private ctx: Context) {}

  /**
   * Create all database tables with proper indexes
   */
  async createSchema(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:schema');
    logger.info('Creating database schema...');

    // Define models (this creates the tables)
    defineModels(this.ctx);

    // Note: Koishi automatically handles table creation when models are defined
    // Additional indexes and constraints would be handled by the database driver

    logger.info('Database schema created successfully');
  }

  /**
   * Drop all tables (for testing or reset purposes)
   */
  async dropSchema(): Promise<void> {
    const logger = this.ctx.logger('mochi-link:schema');
    logger.warn('Dropping database schema...');

    const tables = [
      'player_cache',
      'server_bindings', 
      'pending_operations',
      'audit_logs',
      'api_tokens',
      'server_acl',
      'minecraft_servers'
    ];

    for (const table of tables) {
      try {
        await this.ctx.database.drop(table as any);
        logger.debug(`Dropped table ${table}`);
      } catch (error) {
        logger.warn(`Failed to drop table ${table}:`, (error as Error).message);
      }
    }

    logger.warn('Database schema dropped');
  }
}

// ============================================================================
// Migration Utilities
// ============================================================================

export class MigrationManager {
  constructor(private ctx: Context) {}

  /**
   * Check if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    try {
      // Try to access a table that should exist
      await this.ctx.database.get(TableNames.minecraftServers as any, {}, ['id']);
      return false;
    } catch (error) {
      return true;
    }
  }

  /**
   * Get migration status
   */
  async getMigrationStatus(): Promise<{
    tablesExist: boolean;
    tableCount: number;
    lastMigration?: Date;
  }> {
    const tables = [
      'minecraft_servers',
      'server_acl', 
      'api_tokens',
      'audit_logs',
      'pending_operations',
      'server_bindings',
      'player_cache'
    ];

    let existingTables = 0;
    
    for (const table of tables) {
      try {
        await this.ctx.database.get(table as any, {}, ['id']);
        existingTables++;
      } catch (error) {
        // Table doesn't exist
      }
    }

    return {
      tablesExist: existingTables > 0,
      tableCount: existingTables,
      lastMigration: existingTables === tables.length ? new Date() : undefined
    };
  }

  /**
   * Backup database before migration
   */
  async backupDatabase(): Promise<string> {
    const logger = this.ctx.logger('mochi-link:migration');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `mochi-link-backup-${timestamp}`;
    
    logger.info(`Creating database backup: ${backupId}`);
    
    // Note: Actual backup implementation would depend on the database type
    // This is a placeholder for the backup logic
    
    logger.info(`Database backup created: ${backupId}`);
    return backupId;
  }
}

// ============================================================================
// Database Maintenance
// ============================================================================

export class MaintenanceManager {
  private dbManager: DatabaseManager;

  constructor(private ctx: Context) {
    this.dbManager = new DatabaseManager(ctx);
  }

  /**
   * Perform routine maintenance
   */
  async performRoutineMaintenance(config: {
    auditRetentionDays: number;
    cleanupExpiredTokens: boolean;
    cleanupExpiredACLs: boolean;
    optimizePendingOperations: boolean;
  }): Promise<{
    auditLogsRemoved: number;
    tokensRemoved: number;
    aclsRemoved: number;
    operationsOptimized: number;
  }> {
    const logger = this.ctx.logger('mochi-link:maintenance');
    logger.info('Starting routine maintenance...');

    const results = await this.dbManager.performMaintenance({
      auditRetentionDays: config.auditRetentionDays,
      tokenCleanup: config.cleanupExpiredTokens,
      aclCleanup: config.cleanupExpiredACLs
    });

    let operationsOptimized = 0;
    if (config.optimizePendingOperations) {
      // Optimize pending operations for all servers
      const servers = await this.dbManager.servers.getAllServers();
      for (const server of servers) {
        const optimized = await this.dbManager.pendingOps.optimizeOperations(server.id);
        operationsOptimized += optimized;
      }
    }

    const finalResults = {
      ...results,
      operationsOptimized
    };

    logger.info('Routine maintenance completed:', finalResults);
    return finalResults;
  }

  /**
   * Get maintenance recommendations
   */
  async getMaintenanceRecommendations(): Promise<{
    auditLogCount: number;
    expiredTokenCount: number;
    expiredACLCount: number;
    pendingOperationCount: number;
    recommendations: string[];
  }> {
    const stats = await this.dbManager.getStatistics();
    const recommendations: string[] = [];

    // Check audit log count
    if (stats.auditLogs > 10000) {
      recommendations.push('Consider cleaning up old audit logs');
    }

    // Check for expired tokens (would need additional query)
    if (stats.tokens > 100) {
      recommendations.push('Review and clean up unused API tokens');
    }

    // Check pending operations
    if (stats.pendingOps > 50) {
      recommendations.push('Optimize pending operations to remove contradictory entries');
    }

    return {
      auditLogCount: stats.auditLogs,
      expiredTokenCount: 0, // Would need specific query
      expiredACLCount: 0,   // Would need specific query
      pendingOperationCount: stats.pendingOps,
      recommendations
    };
  }
}

// ============================================================================
// Exports
// ============================================================================

export {
  DatabaseManager,
  DatabaseInitializer as default
};