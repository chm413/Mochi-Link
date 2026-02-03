/**
 * CORS Middleware
 * 
 * Handles Cross-Origin Resource Sharing headers
 */

import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext, CorsConfig } from '../types';

export class CorsMiddleware implements HTTPMiddleware {
  constructor(private config: CorsConfig) {}

  async handle(request: HTTPRequest, response: ServerResponse): Promise<{
    continue: boolean;
    context?: Partial<RequestContext>;
  }> {
    const origin = request.headers.origin;
    
    // Set CORS headers
    if (this.isOriginAllowed(origin)) {
      response.setHeader('Access-Control-Allow-Origin', origin || '*');
    } else if (this.config.origin === true) {
      response.setHeader('Access-Control-Allow-Origin', '*');
    } else if (typeof this.config.origin === 'string') {
      response.setHeader('Access-Control-Allow-Origin', this.config.origin);
    }

    response.setHeader('Access-Control-Allow-Methods', this.config.methods.join(', '));
    response.setHeader('Access-Control-Allow-Headers', this.config.allowedHeaders.join(', '));
    
    if (this.config.credentials) {
      response.setHeader('Access-Control-Allow-Credentials', 'true');
    }

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      response.statusCode = 200;
      response.end();
      return { continue: false };
    }

    return { continue: true };
  }

  private isOriginAllowed(origin?: string): boolean {
    if (!origin) return false;
    
    if (this.config.origin === true) return true;
    if (typeof this.config.origin === 'string') return origin === this.config.origin;
    if (Array.isArray(this.config.origin)) return this.config.origin.includes(origin);
    
    return false;
  }
}