/**
 * Protocol Helper Utilities
 *
 * Provides utility functions for U-WBP v2 protocol compliance
 */
/**
 * Create ISO 8601 timestamp string
 *
 * @returns ISO 8601 formatted timestamp string
 * @example "2024-01-01T00:00:00.000Z"
 */
export declare function createTimestamp(): string;
/**
 * Convert various timestamp formats to ISO 8601 string
 *
 * @param timestamp - Unix milliseconds, Date object, or ISO 8601 string
 * @returns ISO 8601 formatted timestamp string
 */
export declare function normalizeTimestamp(timestamp: number | Date | string): string;
/**
 * Get the current protocol version
 *
 * @returns Protocol version string
 */
export declare function getProtocolVersion(): string;
/**
 * Parse ISO 8601 timestamp to Unix milliseconds
 *
 * @param timestamp - ISO 8601 formatted timestamp string
 * @returns Unix milliseconds
 */
export declare function parseTimestamp(timestamp: string): number;
/**
 * Check if a timestamp is valid ISO 8601 format
 *
 * @param timestamp - Timestamp string to validate
 * @returns true if valid ISO 8601 format
 */
export declare function isValidTimestamp(timestamp: string): boolean;
/**
 * Calculate time difference in milliseconds
 *
 * @param start - Start timestamp (ISO 8601 or Unix ms)
 * @param end - End timestamp (ISO 8601 or Unix ms), defaults to now
 * @returns Time difference in milliseconds
 */
export declare function timeDiff(start: string | number, end?: string | number): number;
/**
 * Format duration in human-readable format
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Human-readable duration string
 */
export declare function formatDuration(milliseconds: number): string;
/**
 * Create a unique message ID
 *
 * @param prefix - Optional prefix for the ID
 * @returns Unique message ID
 */
export declare function createMessageId(prefix?: string): string;
/**
 * Validate protocol version compatibility
 *
 * @param version - Version string to check
 * @returns true if compatible with current protocol version
 */
export declare function isCompatibleVersion(version: string): boolean;
/**
 * Extract event data from BaseEvent (remove metadata fields)
 *
 * @param event - BaseEvent object
 * @returns Event data without metadata fields
 */
export declare function extractEventData(event: any): any;
