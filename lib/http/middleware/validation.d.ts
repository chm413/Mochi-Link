/**
 * Enhanced Validation Middleware
 *
 * Handles comprehensive request validation, sanitization, and schema validation
 */
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext } from '../types';
export declare class ValidationMiddleware implements HTTPMiddleware {
    private schemas;
    constructor();
    handle(request: HTTPRequest, response: ServerResponse): Promise<{
        continue: boolean;
        context?: Partial<RequestContext>;
    }>;
    private initializeSchemas;
    private validateBasicRequest;
    private validateRequestSchema;
    private validateValue;
    private validateFormat;
    private normalizePathForSchema;
    private extractPathParams;
    private sanitizeRequest;
    private sanitizeObject;
    private sendValidationError;
}
