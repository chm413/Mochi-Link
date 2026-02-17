/**
 * U-WBP v2 Protocol Serialization and Deserialization
 *
 * Handles the conversion between U-WBP messages and their wire format (JSON),
 * including compression, encryption, and error handling.
 */
import { UWBPMessage } from '../types';
export interface SerializationOptions {
    compress?: boolean;
    compressionLevel?: number;
    encrypt?: boolean;
    encryptionKey?: string;
    validate?: boolean;
    strictValidation?: boolean;
    pretty?: boolean;
    includeMetadata?: boolean;
}
export interface DeserializationOptions {
    decrypt?: boolean;
    decryptionKey?: string;
    validate?: boolean;
    strictValidation?: boolean;
    throwOnError?: boolean;
    maxSize?: number;
}
export interface SerializationResult {
    success: boolean;
    data?: string | Buffer;
    error?: string;
    metadata?: {
        originalSize: number;
        compressedSize?: number;
        encrypted: boolean;
        compressionRatio?: number;
    };
}
export interface DeserializationResult {
    success: boolean;
    message?: UWBPMessage;
    error?: string;
    warnings?: string[];
    metadata?: {
        size: number;
        wasCompressed: boolean;
        wasEncrypted: boolean;
        validationResult?: any;
    };
}
export declare class MessageSerializer {
    private static readonly DEFAULT_OPTIONS;
    /**
     * Serialize a U-WBP message to JSON string
     */
    static serialize(message: UWBPMessage, options?: SerializationOptions): SerializationResult;
    /**
     * Deserialize JSON string to U-WBP message
     */
    static deserialize(data: string | Buffer, options?: DeserializationOptions): DeserializationResult;
    private static prepareForSerialization;
    private static compress;
    private static decompress;
    private static isCompressed;
    private static encrypt;
    private static decrypt;
}
/**
 * Quick serialize - uses default options
 */
export declare function serialize(message: UWBPMessage): string;
/**
 * Quick deserialize - uses default options
 */
export declare function deserialize(data: string): UWBPMessage;
/**
 * Safe deserialize - returns null on error instead of throwing
 */
export declare function safeDeserialize(data: string): UWBPMessage | null;
/**
 * Validate and serialize
 */
export declare function validateAndSerialize(message: UWBPMessage): string;
/**
 * Deserialize and validate
 */
export declare function deserializeAndValidate(data: string): UWBPMessage;
