/**
 * HTTP Input Validation Middleware
 *
 * Provides comprehensive input validation for HTTP API requests
 */
import { HTTPRequest, APIResponse } from '../types';
export interface ValidationRule {
    field: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'email' | 'uuid' | 'serverId' | 'username' | 'command';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: any[];
    custom?: (value: any) => boolean | string;
}
export interface ValidationSchema {
    body?: ValidationRule[];
    query?: ValidationRule[];
    params?: ValidationRule[];
}
export declare class InputValidationError extends Error {
    field: string;
    message: string;
    value?: any | undefined;
    constructor(field: string, message: string, value?: any | undefined);
}
/**
 * Validate a single field against a rule
 */
export declare function validateField(field: string, value: any, rule: ValidationRule): void;
/**
 * Validate request against schema
 */
export declare function validateRequest(req: HTTPRequest, schema: ValidationSchema): void;
/**
 * Create validation middleware
 */
export declare function createValidationMiddleware(schema: ValidationSchema): (req: HTTPRequest) => Promise<APIResponse | null>;
/**
 * Common validation schemas
 */
export declare const CommonSchemas: {
    pagination: {
        query: ({
            field: string;
            type: "number";
            min: number;
            max?: undefined;
        } | {
            field: string;
            type: "number";
            min: number;
            max: number;
        })[];
    };
    serverId: {
        params: {
            field: string;
            type: "serverId";
            required: boolean;
        }[];
    };
    command: {
        body: ({
            field: string;
            type: "command";
            required: boolean;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "number";
            min: number;
            max: number;
            required?: undefined;
        })[];
    };
    player: {
        params: ({
            field: string;
            type: "serverId";
            required: boolean;
        } | {
            field: string;
            type: "username";
            required: boolean;
        })[];
    };
    whitelist: {
        body: ({
            field: string;
            type: "username";
            required: boolean;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "string";
            min: number;
            max: number;
            required?: undefined;
        })[];
    };
    ban: {
        body: ({
            field: string;
            type: "string";
            required: boolean;
            enum: string[];
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "string";
            required: boolean;
            enum?: undefined;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "string";
            required: boolean;
            min: number;
            max: number;
            enum?: undefined;
        } | {
            field: string;
            type: "number";
            min: number;
            required?: undefined;
            enum?: undefined;
            max?: undefined;
        })[];
    };
    binding: {
        body: ({
            field: string;
            type: "string";
            required: boolean;
            enum?: undefined;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "serverId";
            required: boolean;
            enum?: undefined;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "string";
            required: boolean;
            enum: string[];
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "object";
            required: boolean;
            enum?: undefined;
            min?: undefined;
            max?: undefined;
        } | {
            field: string;
            type: "number";
            min: number;
            max: number;
            required?: undefined;
            enum?: undefined;
        })[];
    };
};
/**
 * Sanitize request data to prevent injection attacks
 */
export declare function sanitizeRequest(req: HTTPRequest): void;
