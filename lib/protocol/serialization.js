"use strict";
/**
 * U-WBP v2 Protocol Serialization and Deserialization
 *
 * Handles the conversion between U-WBP messages and their wire format (JSON),
 * including compression, encryption, and error handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageSerializer = void 0;
exports.serialize = serialize;
exports.deserialize = deserialize;
exports.safeDeserialize = safeDeserialize;
exports.validateAndSerialize = validateAndSerialize;
exports.deserializeAndValidate = deserializeAndValidate;
const types_1 = require("../types");
const validation_1 = require("./validation");
const messages_1 = require("./messages");
// ============================================================================
// Message Serializer
// ============================================================================
class MessageSerializer {
    /**
     * Serialize a U-WBP message to JSON string
     */
    static serialize(message, options = {}) {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };
        try {
            // Validate message if requested
            if (opts.validate) {
                const validationResult = validation_1.MessageValidator.validate(message);
                if (!validationResult.valid && opts.strictValidation) {
                    return {
                        success: false,
                        error: `Validation failed: ${validation_1.ValidationUtils.getValidationSummary(validationResult)}`
                    };
                }
            }
            // Prepare message for serialization
            const messageToSerialize = this.prepareForSerialization(message, opts);
            // Convert to JSON
            const jsonString = opts.pretty
                ? JSON.stringify(messageToSerialize, null, 2)
                : JSON.stringify(messageToSerialize);
            const originalSize = Buffer.byteLength(jsonString, 'utf8');
            let finalData = jsonString;
            let compressedSize;
            let encrypted = false;
            // Apply compression if requested
            if (opts.compress) {
                const compressed = this.compress(jsonString, opts.compressionLevel);
                if (compressed.success && compressed.data) {
                    finalData = compressed.data;
                    compressedSize = compressed.data.length;
                }
            }
            // Apply encryption if requested
            if (opts.encrypt && opts.encryptionKey) {
                const encryptResult = this.encrypt(finalData, opts.encryptionKey);
                if (encryptResult.success && encryptResult.data) {
                    finalData = encryptResult.data;
                    encrypted = true;
                }
            }
            return {
                success: true,
                data: finalData,
                metadata: {
                    originalSize,
                    compressedSize,
                    encrypted,
                    compressionRatio: compressedSize ? originalSize / compressedSize : undefined
                }
            };
        }
        catch (error) {
            return {
                success: false,
                error: `Serialization failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }
    /**
     * Deserialize JSON string to U-WBP message
     */
    static deserialize(data, options = {}) {
        const opts = {
            validate: true,
            strictValidation: false,
            throwOnError: false,
            maxSize: 1024 * 1024, // 1MB default
            ...options
        };
        try {
            // Check size limits
            const dataSize = typeof data === 'string' ? Buffer.byteLength(data, 'utf8') : data.length;
            if (opts.maxSize && dataSize > opts.maxSize) {
                const error = `Data too large: ${dataSize} bytes (max: ${opts.maxSize})`;
                if (opts.throwOnError) {
                    throw new types_1.ProtocolError(error);
                }
                return { success: false, error };
            }
            let processedData = data;
            let wasEncrypted = false;
            let wasCompressed = false;
            // Decrypt if needed
            if (opts.decrypt && opts.decryptionKey) {
                const decryptResult = this.decrypt(processedData, opts.decryptionKey);
                if (decryptResult.success && decryptResult.data) {
                    processedData = decryptResult.data;
                    wasEncrypted = true;
                }
                else {
                    const error = `Decryption failed: ${decryptResult.error}`;
                    if (opts.throwOnError) {
                        throw new types_1.ProtocolError(error);
                    }
                    return { success: false, error };
                }
            }
            // Decompress if needed
            if (this.isCompressed(processedData)) {
                const decompressResult = this.decompress(processedData);
                if (decompressResult.success && decompressResult.data) {
                    processedData = decompressResult.data;
                    wasCompressed = true;
                }
                else {
                    const error = `Decompression failed: ${decompressResult.error}`;
                    if (opts.throwOnError) {
                        throw new types_1.ProtocolError(error);
                    }
                    return { success: false, error };
                }
            }
            // Parse JSON
            const jsonString = typeof processedData === 'string' ? processedData : processedData.toString('utf8');
            const parsed = JSON.parse(jsonString);
            // Validate structure
            if (!(0, messages_1.isUWBPMessage)(parsed)) {
                const error = 'Invalid U-WBP message structure';
                if (opts.throwOnError) {
                    throw new types_1.ProtocolError(error);
                }
                return { success: false, error };
            }
            const message = parsed;
            const warnings = [];
            let validationResult;
            // Validate message if requested
            if (opts.validate) {
                validationResult = validation_1.MessageValidator.validate(message);
                if (!validationResult.valid) {
                    if (opts.strictValidation) {
                        const error = `Validation failed: ${validation_1.ValidationUtils.getValidationSummary(validationResult)}`;
                        if (opts.throwOnError) {
                            throw new types_1.ProtocolError(error, message.id);
                        }
                        return { success: false, error };
                    }
                    else {
                        // Add validation errors as warnings
                        validationResult.errors.forEach(err => {
                            warnings.push(`${err.field}: ${err.message}`);
                        });
                    }
                }
                // Add validation warnings
                validationResult.warnings.forEach(warn => {
                    warnings.push(`${warn.field}: ${warn.message}`);
                });
            }
            return {
                success: true,
                message,
                warnings: warnings.length > 0 ? warnings : undefined,
                metadata: {
                    size: dataSize,
                    wasCompressed,
                    wasEncrypted,
                    validationResult
                }
            };
        }
        catch (error) {
            const errorMessage = `Deserialization failed: ${error instanceof Error ? error.message : String(error)}`;
            if (opts.throwOnError) {
                throw new types_1.ProtocolError(errorMessage);
            }
            return { success: false, error: errorMessage };
        }
    }
    // ============================================================================
    // Helper Methods
    // ============================================================================
    static prepareForSerialization(message, options) {
        const prepared = { ...message };
        // Add metadata if requested
        if (options.includeMetadata) {
            prepared._metadata = {
                serializedAt: Date.now(),
                serializer: 'mochi-link-v2',
                options: {
                    compressed: options.compress,
                    encrypted: options.encrypt
                }
            };
        }
        // Ensure timestamp is present
        if (!prepared.timestamp) {
            prepared.timestamp = Date.now();
        }
        return prepared;
    }
    static compress(data, level) {
        try {
            // Note: In a real implementation, you would use a compression library like zlib
            // For now, we'll simulate compression
            const buffer = Buffer.from(data, 'utf8');
            // Simulate compression by adding a header and the original data
            const header = Buffer.from('MOCHI_COMPRESSED_V1', 'utf8');
            const compressed = Buffer.concat([header, buffer]);
            return { success: true, data: compressed };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    static decompress(data) {
        try {
            const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            // Check for compression header
            const header = Buffer.from('MOCHI_COMPRESSED_V1', 'utf8');
            if (buffer.subarray(0, header.length).equals(header)) {
                // Extract original data
                const originalData = buffer.subarray(header.length);
                return { success: true, data: originalData.toString('utf8') };
            }
            // Not compressed, return as-is
            return { success: true, data: buffer.toString('utf8') };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    static isCompressed(data) {
        try {
            const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const header = Buffer.from('MOCHI_COMPRESSED_V1', 'utf8');
            return buffer.length >= header.length && buffer.subarray(0, header.length).equals(header);
        }
        catch {
            return false;
        }
    }
    static encrypt(data, key) {
        try {
            // Note: In a real implementation, you would use proper encryption
            // For now, we'll simulate encryption with base64 encoding
            const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const keyBuffer = Buffer.from(key, 'utf8');
            // Simple XOR encryption for simulation
            const encrypted = Buffer.alloc(buffer.length);
            for (let i = 0; i < buffer.length; i++) {
                encrypted[i] = buffer[i] ^ keyBuffer[i % keyBuffer.length];
            }
            // Add encryption header
            const header = Buffer.from('MOCHI_ENCRYPTED_V1', 'utf8');
            const result = Buffer.concat([header, encrypted]);
            return { success: true, data: result };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    static decrypt(data, key) {
        try {
            const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
            const header = Buffer.from('MOCHI_ENCRYPTED_V1', 'utf8');
            // Check for encryption header
            if (buffer.length >= header.length && buffer.subarray(0, header.length).equals(header)) {
                const encrypted = buffer.subarray(header.length);
                const keyBuffer = Buffer.from(key, 'utf8');
                // Simple XOR decryption
                const decrypted = Buffer.alloc(encrypted.length);
                for (let i = 0; i < encrypted.length; i++) {
                    decrypted[i] = encrypted[i] ^ keyBuffer[i % keyBuffer.length];
                }
                return { success: true, data: decrypted };
            }
            // Not encrypted, return as-is
            return { success: true, data: buffer };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}
exports.MessageSerializer = MessageSerializer;
MessageSerializer.DEFAULT_OPTIONS = {
    compress: false,
    encrypt: false,
    validate: true,
    strictValidation: false,
    pretty: false,
    includeMetadata: false
};
// ============================================================================
// Convenience Functions
// ============================================================================
/**
 * Quick serialize - uses default options
 */
function serialize(message) {
    const result = MessageSerializer.serialize(message, { validate: true, strictValidation: true });
    if (!result.success) {
        throw new types_1.ProtocolError(`Serialization failed: ${result.error}`);
    }
    return result.data;
}
/**
 * Quick deserialize - uses default options
 */
function deserialize(data) {
    const result = MessageSerializer.deserialize(data);
    if (!result.success) {
        throw new types_1.ProtocolError(`Deserialization failed: ${result.error}`);
    }
    return result.message;
}
/**
 * Safe deserialize - returns null on error instead of throwing
 */
function safeDeserialize(data) {
    const result = MessageSerializer.deserialize(data, { throwOnError: false });
    return result.success ? result.message : null;
}
/**
 * Validate and serialize
 */
function validateAndSerialize(message) {
    validation_1.ValidationUtils.validateOrThrow(message);
    return serialize(message);
}
/**
 * Deserialize and validate
 */
function deserializeAndValidate(data) {
    const message = deserialize(data);
    validation_1.ValidationUtils.validateOrThrow(message);
    return message;
}
