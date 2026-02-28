/**
 * Protocol Helper Utilities
 * 
 * Provides utility functions for U-WBP v2 protocol compliance
 */

import { UWBP_VERSION } from '../protocol/messages';

/**
 * Create ISO 8601 timestamp string
 * 
 * @returns ISO 8601 formatted timestamp string
 * @example "2024-01-01T00:00:00.000Z"
 */
export function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Convert various timestamp formats to ISO 8601 string
 * 
 * @param timestamp - Unix milliseconds, Date object, or ISO 8601 string
 * @returns ISO 8601 formatted timestamp string
 */
export function normalizeTimestamp(timestamp: number | Date | string): string {
  if (typeof timestamp === 'string') {
    // Already a string, validate and return
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp string: ${timestamp}`);
    }
    return date.toISOString();
  }
  
  if (typeof timestamp === 'number') {
    // Unix milliseconds
    return new Date(timestamp).toISOString();
  }
  
  if (timestamp instanceof Date) {
    // Date object
    return timestamp.toISOString();
  }
  
  throw new Error(`Unsupported timestamp type: ${typeof timestamp}`);
}

/**
 * Get the current protocol version
 * 
 * @returns Protocol version string
 */
export function getProtocolVersion(): string {
  return UWBP_VERSION;
}

/**
 * Parse ISO 8601 timestamp to Unix milliseconds
 * 
 * @param timestamp - ISO 8601 formatted timestamp string
 * @returns Unix milliseconds
 */
export function parseTimestamp(timestamp: string): number {
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    throw new Error(`Invalid ISO 8601 timestamp: ${timestamp}`);
  }
  return date.getTime();
}

/**
 * Check if a timestamp is valid ISO 8601 format
 * 
 * @param timestamp - Timestamp string to validate
 * @returns true if valid ISO 8601 format
 */
export function isValidTimestamp(timestamp: string): boolean {
  if (typeof timestamp !== 'string') {
    return false;
  }
  
  const date = new Date(timestamp);
  return !isNaN(date.getTime()) && date.toISOString() === timestamp;
}

/**
 * Calculate time difference in milliseconds
 * 
 * @param start - Start timestamp (ISO 8601 or Unix ms)
 * @param end - End timestamp (ISO 8601 or Unix ms), defaults to now
 * @returns Time difference in milliseconds
 */
export function timeDiff(
  start: string | number,
  end: string | number = Date.now()
): number {
  const startMs = typeof start === 'string' ? parseTimestamp(start) : start;
  const endMs = typeof end === 'string' ? parseTimestamp(end) : end;
  return endMs - startMs;
}

/**
 * Format duration in human-readable format
 * 
 * @param milliseconds - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Create a unique message ID
 * 
 * @param prefix - Optional prefix for the ID
 * @returns Unique message ID
 */
export function createMessageId(prefix = 'msg'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate protocol version compatibility
 * 
 * @param version - Version string to check
 * @returns true if compatible with current protocol version
 */
export function isCompatibleVersion(version: string): boolean {
  // Currently only support 2.0.x versions
  return version.startsWith('2.0');
}

/**
 * Extract event data from BaseEvent (remove metadata fields)
 * 
 * @param event - BaseEvent object
 * @returns Event data without metadata fields
 */
export function extractEventData(event: any): any {
  const { type, serverId, timestamp, version, ...data } = event;
  return data;
}
