"use strict";
/**
 * Logging Middleware
 *
 * Logs HTTP requests and responses for monitoring and debugging
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingMiddleware = void 0;
class LoggingMiddleware {
    constructor(logger) {
        this.logger = logger;
    }
    async handle(request, response) {
        const startTime = Date.now();
        // Log incoming request
        this.logger.debug(`${request.method} ${request.path}`, {
            ip: request.context.ipAddress,
            userAgent: request.context.userAgent,
            requestId: request.context.requestId
        });
        // Hook into response to log completion
        const originalEnd = response.end;
        response.end = function (...args) {
            const duration = Date.now() - startTime;
            // Log response
            const logger = this._logger;
            if (logger) {
                logger.info(`${request.method} ${request.path} ${this.statusCode} ${duration}ms`, {
                    statusCode: this.statusCode,
                    duration,
                    requestId: request.context.requestId
                });
            }
            return originalEnd.apply(this, args);
        };
        // Store logger reference for response logging
        response._logger = this.logger;
        return { continue: true };
    }
}
exports.LoggingMiddleware = LoggingMiddleware;
