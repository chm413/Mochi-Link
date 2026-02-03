/**
 * Logging Middleware
 * 
 * Logs HTTP requests and responses for monitoring and debugging
 */

import { Logger } from 'koishi';
import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext } from '../types';

export class LoggingMiddleware implements HTTPMiddleware {
  constructor(private logger: Logger) {}

  async handle(request: HTTPRequest, response: ServerResponse): Promise<{
    continue: boolean;
    context?: Partial<RequestContext>;
  }> {
    const startTime = Date.now();
    
    // Log incoming request
    this.logger.debug(`${request.method} ${request.path}`, {
      ip: request.context.ipAddress,
      userAgent: request.context.userAgent,
      requestId: request.context.requestId
    });

    // Hook into response to log completion
    const originalEnd = response.end;
    response.end = function(this: ServerResponse, ...args: any[]) {
      const duration = Date.now() - startTime;
      
      // Log response
      const logger = (this as any)._logger;
      if (logger) {
        logger.info(`${request.method} ${request.path} ${this.statusCode} ${duration}ms`, {
          statusCode: this.statusCode,
          duration,
          requestId: request.context.requestId
        });
      }
      
      return originalEnd.apply(this, args as any);
    };

    // Store logger reference for response logging
    (response as any)._logger = this.logger;

    return { continue: true };
  }
}