"use strict";
/**
 * Plugin Integration Framework
 *
 * This module provides a unified interface for integrating with popular Minecraft plugins
 * including PlaceholderAPI, Plan, LuckPerms, and Vault. It handles plugin detection,
 * capability registration, and provides fallback mechanisms when plugins are unavailable.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PluginRegistryImpl = exports.PluginManagerImpl = void 0;
__exportStar(require("./types"), exports);
var manager_1 = require("./manager");
Object.defineProperty(exports, "PluginManagerImpl", { enumerable: true, get: function () { return manager_1.PluginManager; } });
__exportStar(require("./integrations/placeholderapi"), exports);
__exportStar(require("./integrations/plan"), exports);
__exportStar(require("./integrations/luckperms"), exports);
__exportStar(require("./integrations/vault"), exports);
var registry_1 = require("./registry");
Object.defineProperty(exports, "PluginRegistryImpl", { enumerable: true, get: function () { return registry_1.PluginRegistry; } });
