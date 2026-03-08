/**
 * HTTP Input Validation Middleware
 * 
 * Provides comprehensive input validation for HTTP API requests
 */

import { HTTPRequest, APIResponse } from '../types';
import { validateServerId, validateUsername, validateCommand } from '../../utils/security';

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

export class InputValidationError extends Error {
  constructor(
    public field: string,
    public message: string,
    public value?: any
  ) {
    super(`Validation error for field '${field}': ${message}`);
    this.name = 'InputValidationError';
  }
}

/**
 * Validate a single field against a rule
 */
export function validateField(field: string, value: any, rule: ValidationRule): void {
  // Check required
  if (rule.required && (value === undefined || value === null || value === '')) {
    throw new InputValidationError(field, 'Field is required');
  }

  // Skip validation if not required and value is empty
  if (!rule.required && (value === undefined || value === null || value === '')) {
    return;
  }

  // Type validation
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      if (rule.min !== undefined && value.length < rule.min) {
        throw new InputValidationError(field, `Must be at least ${rule.min} characters`, value);
      }
      if (rule.max !== undefined && value.length > rule.max) {
        throw new InputValidationError(field, `Must be at most ${rule.max} characters`, value);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        throw new InputValidationError(field, 'Invalid format', value);
      }
      break;

    case 'number':
      const num = typeof value === 'string' ? parseFloat(value) : value;
      if (typeof num !== 'number' || isNaN(num)) {
        throw new InputValidationError(field, 'Must be a number', value);
      }
      if (rule.min !== undefined && num < rule.min) {
        throw new InputValidationError(field, `Must be at least ${rule.min}`, value);
      }
      if (rule.max !== undefined && num > rule.max) {
        throw new InputValidationError(field, `Must be at most ${rule.max}`, value);
      }
      break;

    case 'boolean':
      if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
        throw new InputValidationError(field, 'Must be a boolean', value);
      }
      break;

    case 'array':
      if (!Array.isArray(value)) {
        throw new InputValidationError(field, 'Must be an array', value);
      }
      if (rule.min !== undefined && value.length < rule.min) {
        throw new InputValidationError(field, `Must have at least ${rule.min} items`, value);
      }
      if (rule.max !== undefined && value.length > rule.max) {
        throw new InputValidationError(field, `Must have at most ${rule.max} items`, value);
      }
      break;

    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new InputValidationError(field, 'Must be an object', value);
      }
      break;

    case 'email':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(value)) {
        throw new InputValidationError(field, 'Invalid email format', value);
      }
      break;

    case 'uuid':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(value)) {
        throw new InputValidationError(field, 'Invalid UUID format', value);
      }
      break;

    case 'serverId':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      if (!validateServerId(value)) {
        throw new InputValidationError(field, 'Invalid server ID format', value);
      }
      break;

    case 'username':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      if (!validateUsername(value)) {
        throw new InputValidationError(field, 'Invalid username format', value);
      }
      break;

    case 'command':
      if (typeof value !== 'string') {
        throw new InputValidationError(field, 'Must be a string', value);
      }
      if (!validateCommand(value)) {
        throw new InputValidationError(field, 'Invalid command format', value);
      }
      break;
  }

  // Enum validation
  if (rule.enum && !rule.enum.includes(value)) {
    throw new InputValidationError(field, `Must be one of: ${rule.enum.join(', ')}`, value);
  }

  // Custom validation
  if (rule.custom) {
    const result = rule.custom(value);
    if (result !== true) {
      throw new InputValidationError(field, typeof result === 'string' ? result : 'Custom validation failed', value);
    }
  }
}

/**
 * Validate request against schema
 */
export function validateRequest(req: HTTPRequest, schema: ValidationSchema): void {
  // Validate body
  if (schema.body) {
    for (const rule of schema.body) {
      const value = req.body?.[rule.field];
      validateField(`body.${rule.field}`, value, rule);
    }
  }

  // Validate query
  if (schema.query) {
    for (const rule of schema.query) {
      const value = req.query?.[rule.field];
      validateField(`query.${rule.field}`, value, rule);
    }
  }

  // Validate params
  if (schema.params) {
    for (const rule of schema.params) {
      const value = (req.context as any)?.[rule.field];
      validateField(`params.${rule.field}`, value, rule);
    }
  }
}

/**
 * Create validation middleware
 */
export function createValidationMiddleware(schema: ValidationSchema) {
  return async (req: HTTPRequest): Promise<APIResponse | null> => {
    try {
      validateRequest(req, schema);
      return null; // Validation passed, continue
    } catch (error) {
      if (error instanceof InputValidationError) {
        return {
          success: false,
          error: 'VALIDATION_ERROR',
          message: error.message,
          timestamp: Date.now(),
          requestId: req.context.requestId,
          metadata: {
            field: error.field,
            value: error.value
          }
        } as APIResponse;
      }
      throw error;
    }
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  pagination: {
    query: [
      { field: 'page', type: 'number' as const, min: 1 },
      { field: 'limit', type: 'number' as const, min: 1, max: 100 }
    ]
  },

  serverId: {
    params: [
      { field: 'serverId', type: 'serverId' as const, required: true }
    ]
  },

  command: {
    body: [
      { field: 'command', type: 'command' as const, required: true },
      { field: 'timeout', type: 'number' as const, min: 1000, max: 300000 }
    ]
  },

  player: {
    params: [
      { field: 'serverId', type: 'serverId' as const, required: true },
      { field: 'playerId', type: 'username' as const, required: true }
    ]
  },

  whitelist: {
    body: [
      { field: 'playerId', type: 'username' as const, required: true },
      { field: 'playerName', type: 'string' as const, min: 1, max: 16 }
    ]
  },

  ban: {
    body: [
      { field: 'type', type: 'string' as const, required: true, enum: ['player', 'ip'] },
      { field: 'target', type: 'string' as const, required: true },
      { field: 'reason', type: 'string' as const, required: true, min: 1, max: 500 },
      { field: 'duration', type: 'number' as const, min: 0 }
    ]
  },

  binding: {
    body: [
      { field: 'groupId', type: 'string' as const, required: true },
      { field: 'serverId', type: 'serverId' as const, required: true },
      { field: 'bindingType', type: 'string' as const, required: true, enum: ['event', 'command', 'status'] },
      { field: 'config', type: 'object' as const, required: true },
      { field: 'priority', type: 'number' as const, min: 0, max: 100 }
    ]
  }
};

/**
 * Sanitize request data to prevent injection attacks
 */
export function sanitizeRequest(req: HTTPRequest): void {
  // Sanitize body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
}

function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Remove potentially dangerous keys
      if (key.startsWith('__') || key.startsWith('$')) {
        continue;
      }
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    // Remove null bytes
    return obj.replace(/\0/g, '');
  }

  return obj;
}
