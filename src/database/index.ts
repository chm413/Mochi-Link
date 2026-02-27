/**
 * Mochi-Link (大福连) - Database Module Index
 * 
 * This file exports all database-related classes and utilities.
 */

// Core database operations
export { DatabaseManager } from './operations';
export { DatabaseInitializer } from './init';

// Database models and utilities
export { defineModels, ModelUtils, runMigrations, checkDatabaseHealth } from './models';

// Performance optimization
export { DatabaseQueryOptimizer } from './optimization';

// Types (re-export from main types)
export type {
  DatabaseServer,
  DatabaseServerACL,
  DatabaseAPIToken,
  DatabaseAuditLog,
  DatabasePendingOperation,
  DatabaseServerBinding,
  DatabasePlayerCache
} from '../types';