"use strict";
/**
 * Enhanced Validation Middleware
 *
 * Handles comprehensive request validation, sanitization, and schema validation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationMiddleware = void 0;
class ValidationMiddleware {
    constructor() {
        this.schemas = new Map();
        this.initializeSchemas();
    }
    async handle(request, response) {
        // Basic request validation
        const basicValidation = this.validateBasicRequest(request);
        if (!basicValidation.valid) {
            this.sendValidationError(response, basicValidation.errors);
            return { continue: false };
        }
        // Schema-based validation
        const schemaValidation = this.validateRequestSchema(request);
        if (!schemaValidation.valid) {
            this.sendValidationError(response, schemaValidation.errors);
            return { continue: false };
        }
        // Sanitize request data
        const sanitizedRequest = this.sanitizeRequest(request);
        return {
            continue: true,
            context: {
                sanitizedBody: sanitizedRequest.body,
                sanitizedQuery: sanitizedRequest.query
            }
        };
    }
    initializeSchemas() {
        // Server management schemas
        this.schemas.set('POST:/api/servers', {
            path: '/api/servers',
            method: 'POST',
            bodySchema: {
                type: 'object',
                required: ['name', 'coreType', 'connectionMode', 'connectionConfig'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 255 },
                    coreType: { type: 'string', enum: ['Java', 'Bedrock'] },
                    coreName: { type: 'string', minLength: 1, maxLength: 64 },
                    coreVersion: { type: 'string', maxLength: 32 },
                    connectionMode: { type: 'string', enum: ['plugin', 'rcon', 'terminal'] },
                    connectionConfig: { type: 'object' },
                    tags: { type: 'array', items: { type: 'string' } }
                }
            }
        });
        this.schemas.set('PUT:/api/servers/:serverId', {
            path: '/api/servers/:serverId',
            method: 'PUT',
            paramsSchema: {
                type: 'object',
                required: ['serverId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
                }
            },
            bodySchema: {
                type: 'object',
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 255 },
                    connectionConfig: { type: 'object' },
                    tags: { type: 'array', items: { type: 'string' } }
                }
            }
        });
        // Player management schemas
        this.schemas.set('POST:/api/servers/:serverId/players/:playerId/kick', {
            path: '/api/servers/:serverId/players/:playerId/kick',
            method: 'POST',
            paramsSchema: {
                type: 'object',
                required: ['serverId', 'playerId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' },
                    playerId: { type: 'string', minLength: 1 }
                }
            },
            bodySchema: {
                type: 'object',
                required: ['reason'],
                properties: {
                    reason: { type: 'string', minLength: 1, maxLength: 255 }
                }
            }
        });
        // Whitelist management schemas
        this.schemas.set('POST:/api/servers/:serverId/whitelist', {
            path: '/api/servers/:serverId/whitelist',
            method: 'POST',
            paramsSchema: {
                type: 'object',
                required: ['serverId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
                }
            },
            bodySchema: {
                type: 'object',
                required: ['playerId'],
                properties: {
                    playerId: { type: 'string', minLength: 1 },
                    playerName: { type: 'string', minLength: 3, maxLength: 16 }
                }
            }
        });
        // Ban management schemas
        this.schemas.set('POST:/api/servers/:serverId/bans', {
            path: '/api/servers/:serverId/bans',
            method: 'POST',
            paramsSchema: {
                type: 'object',
                required: ['serverId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
                }
            },
            bodySchema: {
                type: 'object',
                required: ['type', 'target', 'reason'],
                properties: {
                    type: { type: 'string', enum: ['player', 'ip', 'device'] },
                    target: { type: 'string', minLength: 1 },
                    reason: { type: 'string', minLength: 1, maxLength: 255 },
                    duration: { type: 'number', minimum: 1 }
                }
            }
        });
        // Command execution schemas
        this.schemas.set('POST:/api/servers/:serverId/commands', {
            path: '/api/servers/:serverId/commands',
            method: 'POST',
            paramsSchema: {
                type: 'object',
                required: ['serverId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
                }
            },
            bodySchema: {
                type: 'object',
                required: ['command'],
                properties: {
                    command: { type: 'string', minLength: 1, maxLength: 1000 },
                    timeout: { type: 'number', minimum: 1000, maximum: 300000 }
                }
            }
        });
        // Query parameter schemas for paginated endpoints
        const paginationQuerySchema = {
            type: 'object',
            properties: {
                page: { type: 'number', minimum: 1 },
                limit: { type: 'number', minimum: 1, maximum: 100 }
            }
        };
        this.schemas.set('GET:/api/servers', {
            path: '/api/servers',
            method: 'GET',
            querySchema: paginationQuerySchema
        });
        this.schemas.set('GET:/api/servers/:serverId/players', {
            path: '/api/servers/:serverId/players',
            method: 'GET',
            paramsSchema: {
                type: 'object',
                required: ['serverId'],
                properties: {
                    serverId: { type: 'string', pattern: '^[a-zA-Z0-9_-]+$' }
                }
            },
            querySchema: paginationQuerySchema
        });
    }
    validateBasicRequest(request) {
        const errors = [];
        // Validate content type for POST/PUT requests
        if (['POST', 'PUT'].includes(request.method)) {
            const contentType = request.headers['content-type'];
            if (!contentType || !contentType.includes('application/json')) {
                errors.push({
                    field: 'content-type',
                    message: 'Content-Type must be application/json for POST/PUT requests',
                    value: contentType
                });
            }
        }
        // Validate request body size
        if (request.body) {
            const bodySize = JSON.stringify(request.body).length;
            if (bodySize > 1024 * 1024) { // 1MB limit
                errors.push({
                    field: 'body',
                    message: 'Request body too large (max 1MB)',
                    value: bodySize.toString()
                });
            }
        }
        // Validate path format
        if (request.path.includes('..') || request.path.includes('//')) {
            errors.push({
                field: 'path',
                message: 'Invalid path format - path traversal not allowed',
                value: request.path
            });
        }
        // Validate HTTP method
        const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
        if (!allowedMethods.includes(request.method)) {
            errors.push({
                field: 'method',
                message: 'HTTP method not allowed',
                value: request.method
            });
        }
        // Validate headers
        const userAgent = request.headers['user-agent'];
        if (userAgent && userAgent.length > 500) {
            errors.push({
                field: 'user-agent',
                message: 'User-Agent header too long',
                value: userAgent.substring(0, 50) + '...'
            });
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    validateRequestSchema(request) {
        const schemaKey = `${request.method}:${this.normalizePathForSchema(request.path)}`;
        const schema = this.schemas.get(schemaKey);
        if (!schema) {
            // No schema defined for this endpoint, skip validation
            return { valid: true, errors: [] };
        }
        const errors = [];
        // Validate request body
        if (schema.bodySchema && request.body) {
            const bodyErrors = this.validateValue(request.body, schema.bodySchema, 'body');
            errors.push(...bodyErrors);
        }
        // Validate query parameters
        if (schema.querySchema && request.query) {
            const queryErrors = this.validateValue(request.query, schema.querySchema, 'query');
            errors.push(...queryErrors);
        }
        // Validate path parameters
        if (schema.paramsSchema) {
            const params = this.extractPathParams(schema.path, request.path);
            const paramErrors = this.validateValue(params, schema.paramsSchema, 'params');
            errors.push(...paramErrors);
        }
        return {
            valid: errors.length === 0,
            errors
        };
    }
    validateValue(value, schema, fieldPath) {
        const errors = [];
        // Type validation
        if (schema.type && typeof value !== schema.type && schema.type !== 'array') {
            if (!(schema.type === 'number' && !isNaN(Number(value)))) {
                errors.push({
                    field: fieldPath,
                    message: `Expected type ${schema.type}, got ${typeof value}`,
                    value: String(value)
                });
                return errors;
            }
        }
        // Array validation
        if (schema.type === 'array') {
            if (!Array.isArray(value)) {
                errors.push({
                    field: fieldPath,
                    message: 'Expected array',
                    value: String(value)
                });
                return errors;
            }
            if (schema.items) {
                value.forEach((item, index) => {
                    const itemErrors = this.validateValue(item, schema.items, `${fieldPath}[${index}]`);
                    errors.push(...itemErrors);
                });
            }
        }
        // Object validation
        if (schema.type === 'object' && value && typeof value === 'object') {
            // Required fields
            if (schema.required) {
                for (const requiredField of schema.required) {
                    if (!(requiredField in value)) {
                        errors.push({
                            field: `${fieldPath}.${requiredField}`,
                            message: 'Required field is missing',
                            value: 'undefined'
                        });
                    }
                }
            }
            // Property validation
            if (schema.properties) {
                for (const [propName, propSchema] of Object.entries(schema.properties)) {
                    if (propName in value) {
                        const propErrors = this.validateValue(value[propName], propSchema, `${fieldPath}.${propName}`);
                        errors.push(...propErrors);
                    }
                }
            }
        }
        // String validation
        if (schema.type === 'string' && typeof value === 'string') {
            if (schema.minLength && value.length < schema.minLength) {
                errors.push({
                    field: fieldPath,
                    message: `String too short (min: ${schema.minLength})`,
                    value: value
                });
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                errors.push({
                    field: fieldPath,
                    message: `String too long (max: ${schema.maxLength})`,
                    value: value.substring(0, 50) + (value.length > 50 ? '...' : '')
                });
            }
            if (schema.pattern) {
                const regex = new RegExp(schema.pattern);
                if (!regex.test(value)) {
                    errors.push({
                        field: fieldPath,
                        message: `String does not match pattern: ${schema.pattern}`,
                        value: value
                    });
                }
            }
            if (schema.format) {
                const formatError = this.validateFormat(value, schema.format);
                if (formatError) {
                    errors.push({
                        field: fieldPath,
                        message: formatError,
                        value: value
                    });
                }
            }
        }
        // Number validation
        if (schema.type === 'number') {
            const numValue = typeof value === 'string' ? Number(value) : value;
            if (isNaN(numValue)) {
                errors.push({
                    field: fieldPath,
                    message: 'Invalid number',
                    value: String(value)
                });
            }
            else {
                if (schema.minimum !== undefined && numValue < schema.minimum) {
                    errors.push({
                        field: fieldPath,
                        message: `Number too small (min: ${schema.minimum})`,
                        value: String(numValue)
                    });
                }
                if (schema.maximum !== undefined && numValue > schema.maximum) {
                    errors.push({
                        field: fieldPath,
                        message: `Number too large (max: ${schema.maximum})`,
                        value: String(numValue)
                    });
                }
            }
        }
        // Enum validation
        if (schema.enum && !schema.enum.includes(value)) {
            errors.push({
                field: fieldPath,
                message: `Value must be one of: ${schema.enum.join(', ')}`,
                value: String(value)
            });
        }
        return errors;
    }
    validateFormat(value, format) {
        switch (format) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value) ? null : 'Invalid email format';
            case 'uuid':
                const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
                return uuidRegex.test(value) ? null : 'Invalid UUID format';
            case 'date-time':
                const date = new Date(value);
                return !isNaN(date.getTime()) ? null : 'Invalid date-time format';
            case 'hostname':
                const hostnameRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
                return hostnameRegex.test(value) ? null : 'Invalid hostname format';
            case 'ipv4':
                const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
                return ipv4Regex.test(value) ? null : 'Invalid IPv4 format';
            case 'ipv6':
                const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
                return ipv6Regex.test(value) ? null : 'Invalid IPv6 format';
            default:
                return null;
        }
    }
    normalizePathForSchema(path) {
        // Convert actual path to schema pattern
        // e.g., /api/servers/server123 -> /api/servers/:serverId
        return path
            .replace(/\/api\/servers\/[^\/]+$/, '/api/servers/:serverId')
            .replace(/\/api\/servers\/[^\/]+\/players\/[^\/]+\/kick$/, '/api/servers/:serverId/players/:playerId/kick')
            .replace(/\/api\/servers\/[^\/]+\/players$/, '/api/servers/:serverId/players')
            .replace(/\/api\/servers\/[^\/]+\/whitelist$/, '/api/servers/:serverId/whitelist')
            .replace(/\/api\/servers\/[^\/]+\/bans$/, '/api/servers/:serverId/bans')
            .replace(/\/api\/servers\/[^\/]+\/commands$/, '/api/servers/:serverId/commands');
    }
    extractPathParams(schemaPath, actualPath) {
        const schemaParts = schemaPath.split('/');
        const actualParts = actualPath.split('/');
        const params = {};
        for (let i = 0; i < schemaParts.length; i++) {
            const schemaPart = schemaParts[i];
            if (schemaPart.startsWith(':')) {
                const paramName = schemaPart.slice(1);
                params[paramName] = actualParts[i] || '';
            }
        }
        return params;
    }
    sanitizeRequest(request) {
        return {
            body: this.sanitizeObject(request.body),
            query: this.sanitizeObject(request.query)
        };
    }
    sanitizeObject(obj) {
        if (obj === null || obj === undefined) {
            return obj;
        }
        if (typeof obj === 'string') {
            // Remove potentially dangerous characters
            return obj
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
                .replace(/javascript:/gi, '') // Remove javascript: protocol
                .replace(/on\w+\s*=/gi, '') // Remove event handlers
                .trim();
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        if (typeof obj === 'object') {
            const sanitized = {};
            for (const [key, value] of Object.entries(obj)) {
                // Sanitize key names
                const sanitizedKey = key.replace(/[^\w.-]/g, '');
                if (sanitizedKey) {
                    sanitized[sanitizedKey] = this.sanitizeObject(value);
                }
            }
            return sanitized;
        }
        return obj;
    }
    sendValidationError(response, errors) {
        response.statusCode = 400;
        response.setHeader('Content-Type', 'application/json');
        response.setHeader('X-Validation-Failed', 'true');
        response.end(JSON.stringify({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: errors,
            timestamp: Date.now()
        }));
    }
}
exports.ValidationMiddleware = ValidationMiddleware;
