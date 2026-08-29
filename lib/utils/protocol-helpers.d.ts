/**
 * Protocol Helper Utilities
 *
 * Provides utility functions for U-WBP v2 protocol compliance
 */
/**
 * Create a canonical U-WBP timestamp
 *
 * @returns Unix epoch milliseconds
 */
export declare function createTimestamp(): number;
/**
 * Convert supported timestamp formats to canonical Unix milliseconds
 *
 * @param timestamp - Unix milliseconds, Date object, or ISO 8601 string
 * @returns Unix epoch milliseconds
 */
export declare function normalizeTimestamp(timestamp: number | Date | string): number;
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
 * Check if a timestamp is a valid canonical Unix millisecond value
 *
 * @param timestamp - Timestamp value to validate
 * @returns true if it is a finite non-negative integer
 */
export declare function isValidTimestamp(timestamp: unknown): timestamp is number;
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
