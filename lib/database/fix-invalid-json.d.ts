/**
 * Database JSON Field Repair Utility
 *
 * This script fixes invalid JSON data in database text fields that should contain JSON.
 * It handles empty strings, malformed JSON, and null values.
 */
import { Context } from 'koishi';
export declare function fixInvalidJsonFields(ctx: Context): Promise<{
    serversFixed: number;
    aclsFixed: number;
    tokensFixed: number;
    auditsFixed: number;
    operationsFixed: number;
}>;
