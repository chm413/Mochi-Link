/**
 * U-WBP v2 Protocol Message Validation
 *
 * Provides comprehensive validation for all U-WBP v2 protocol messages
 * including structure validation, data type checking, and business logic validation.
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
    severity: 'error' | 'warning';
}
export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}
export declare class ValidationRules {
    static readonly MESSAGE_ID_PATTERN: RegExp;
    static readonly MESSAGE_ID_MAX_LENGTH = 50;
    static readonly OPERATION_PATTERN: RegExp;
    static readonly OPERATION_MAX_LENGTH = 100;
    static readonly SERVER_ID_PATTERN: RegExp;
    static readonly SERVER_ID_MAX_LENGTH = 64;
    static readonly MAX_DATA_SIZE: number;
    static readonly MAX_STRING_LENGTH = 10000;
    static readonly MAX_ARRAY_LENGTH = 1000;
    static readonly MIN_TIMEOUT = 1000;
    static readonly MAX_TIMEOUT = 300000;
}
export declare class MessageValidator {
    /**
     * Validate any U-WBP message
     */
    static validate(message: any): ValidationResult;
    /**
     * Validate basic message structure
     */
    private static validateBasicStructure;
    /**
     * Validate request message
     */
    private static validateRequest;
    /**
     * Validate response message
     */
    private static validateResponse;
    /**
     * Validate event message
     */
    private static validateEvent;
    /**
     * Validate system message
     */
    private static validateSystemMessage;
    private static validateMessageId;
    private static validateOperation;
    private static validateData;
    private static validateDataStructure;
    private static validateTimestamp;
    private static validateServerId;
    private static validateVersion;
    private static validateTimeout;
    private static isValidRequestOperation;
    private static isValidEventOperation;
    private static isValidSystemOperation;
    private static validateRequestData;
    private static validateEventData;
    private static validateSystemData;
    private static addError;
    private static addWarning;
}
export declare class ValidationUtils {
    /**
     * Quick validation check - returns true if message is valid
     */
    static isValid(message: any): boolean;
    /**
     * Validate and throw error if invalid
     */
    static validateOrThrow(message: any): void;
    /**
     * Get validation summary
     */
    static getValidationSummary(result: ValidationResult): string;
}
