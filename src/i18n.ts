/**
 * Mochi-Link (大福连) - Internationalization Helper
 * 
 * Simple i18n helper for Koishi plugin
 */

import { Session } from 'koishi';

/**
 * Format message with parameters
 */
export function formatMessage(template: string, ...args: any[]): string {
  return template.replace(/\{(\d+)\}/g, (match, index) => {
    const argIndex = parseInt(index);
    return args[argIndex] !== undefined ? String(args[argIndex]) : match;
  });
}

/**
 * Get session locale or default
 */
export function getLocale(session?: Session): string {
  return session?.locales?.[0] || session?.locale || 'zh-CN';
}

/**
 * Simple translation function
 * Falls back to Chinese if translation not found
 */
export function translate(key: string, locale: string = 'zh-CN'): string {
  // This is a placeholder - actual translations are loaded by Koishi
  // from locales/*.yml files
  return key;
}
