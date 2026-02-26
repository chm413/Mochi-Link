/**
 * Plugin Integration Framework
 *
 * This module provides a unified interface for integrating with popular Minecraft plugins
 * including PlaceholderAPI, Plan, LuckPerms, and Vault. It handles plugin detection,
 * capability registration, and provides fallback mechanisms when plugins are unavailable.
 */
export * from './types';
export { PluginManager as PluginManagerImpl } from './manager';
export * from './integrations/placeholderapi';
export * from './integrations/plan';
export * from './integrations/luckperms';
export * from './integrations/vault';
export { PluginRegistry as PluginRegistryImpl } from './registry';
