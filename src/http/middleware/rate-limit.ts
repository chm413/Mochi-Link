/**
 * Rate Limiting Middleware
 * 
 * Implements rate limiting based on IP address and user ID
 */

import { ServerResponse } from 'http';
import { HTTPRequest } from '../types';
import { HTTPMiddleware } from '../server';
import { RequestContext, RateLimitConfig } from '../types';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

export class RateLimitMiddleware implements HTTPMiddleware {
  private ipLimits = new Map<string, RateLimitEntry>();
  private userLimits = new Map<string, RateLimitEntry>();

  constructor(private config: RateLimitConfig) {
    // Clean up expired entries every minute
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000);
  }

  async handle(request: HTTPRequest, response: ServerResponse): Promise<{
    continue: boolean;
    context?: Partial<RequestContext>;
  }> {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;
    
    // Check IP-based rate limit
    const ipKey = request.context.ipAddress;
    if (!this.checkLimit(this.ipLimits, ipKey, windowStart, now)) {
      this.sendRateLimitExceeded(response, 'IP rate limit exceeded');
      return { continue: false };
    }

    // Check user-based rate limit if user is authenticated
    if (request.context.userId) {
      const userKey = request.context.userId;
      if (!this.checkLimit(this.userLimits, userKey, windowStart, now)) {
        this.sendRateLimitExceeded(response, 'User rate limit exceeded');
        return { continue: false };
      }
    }

    return { continue: true };
  }

  private checkLimit(
    limitMap: Map<string, RateLimitEntry>,
    key: string,
    windowStart: number,
    now: number
  ): boolean {
    let entry = limitMap.get(key);
    
    if (!entry || entry.resetTime <= windowStart) {
      // Create new entry or reset expired entry
      entry = {
        count: 1,
        resetTime: now + this.config.windowMs
      };
      limitMap.set(key, entry);
      return true;
    }

    if (entry.count >= this.config.maxRequests) {
      return false; // Rate limit exceeded
    }

    entry.count++;
    return true;
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    
    // Clean IP limits
    for (const [key, entry] of this.ipLimits.entries()) {
      if (entry.resetTime <= now) {
        this.ipLimits.delete(key);
      }
    }

    // Clean user limits
    for (const [key, entry] of this.userLimits.entries()) {
      if (entry.resetTime <= now) {
        this.userLimits.delete(key);
      }
    }
  }

  private sendRateLimitExceeded(response: ServerResponse, message: string): void {
    response.statusCode = 429;
    response.setHeader('Content-Type', 'application/json');
    response.setHeader('Retry-After', Math.ceil(this.config.windowMs / 1000).toString());
    response.end(JSON.stringify({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message,
      timestamp: Date.now()
    }));
  }
}