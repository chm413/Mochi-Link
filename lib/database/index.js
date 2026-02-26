"use strict";
/**
 * Mochi-Link (大福连) - Database Module Index
 *
 * This file exports all database-related classes and utilities.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseQueryOptimizer = exports.checkDatabaseHealth = exports.runMigrations = exports.ModelUtils = exports.defineModels = exports.DatabaseInitializer = exports.DatabaseManager = void 0;
// Core database operations
var operations_1 = require("./operations");
Object.defineProperty(exports, "DatabaseManager", { enumerable: true, get: function () { return operations_1.DatabaseManager; } });
var init_1 = require("./init");
Object.defineProperty(exports, "DatabaseInitializer", { enumerable: true, get: function () { return init_1.DatabaseInitializer; } });
// Database models and utilities
var models_1 = require("./models");
Object.defineProperty(exports, "defineModels", { enumerable: true, get: function () { return models_1.defineModels; } });
Object.defineProperty(exports, "ModelUtils", { enumerable: true, get: function () { return models_1.ModelUtils; } });
Object.defineProperty(exports, "runMigrations", { enumerable: true, get: function () { return models_1.runMigrations; } });
Object.defineProperty(exports, "checkDatabaseHealth", { enumerable: true, get: function () { return models_1.checkDatabaseHealth; } });
// Performance optimization
var optimization_1 = require("./optimization");
Object.defineProperty(exports, "DatabaseQueryOptimizer", { enumerable: true, get: function () { return optimization_1.DatabaseQueryOptimizer; } });
