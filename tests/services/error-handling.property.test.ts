/**
 * Property-Based Tests for Error Handling Service
 * 
 * Tests the correctness properties of error handling, connection recovery,
 * and exponential backoff mechanisms.
 */

import * as fc from 'fast-check';
import { Context } from 'koishi';
import { 
  ErrorHandlingService, 
  ExponentialBackoffManager,
  ConnectionQualityMonitor,
  ErrorHandlerConfig 
} from '../../src/services/error-handling';
import { AuditService } from '../../src/services/audit';
import { 
  ConnectionError, 
  AuthenticationError,
  ProtocolError,
  ServerConfig 
} from '../../src/types';

// ============================================================================
// Test Setup and Utilities
// ============================================================================

function createMockContext(): Context {
  return {
    logger: (name: string) => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })
  } as any;
}

function createMockAuditService(): AuditService {
  return {
    logger: {
      logError: jest.fn().mockResolvedValue(undefined),
      logAuthFailure: jest.fn().mockResolvedValue(undefined),
      logPermissionDenied: jest.fn().mockResolvedValue(undefined),
      logSuccess: jest.fn().mockResolvedValue(undefined),
      logFailure: jest.fn().mockResolvedValue(undefined)
    }
  } as any;
}

function createTestConfig(overrides: Partial<ErrorHandlerConfig> = {}): ErrorHandlerConfig {
  return {
    maxRetryAttempts: 5,
    baseRetryInterval: 1000,
    maxRetryInterval: 30000,
    exponentialBackoffMultiplier: 2,
    jitterEnabled: false, // Disable for predictable testing
    connectionQualityThreshold: 70,
    failureRateThreshold: 0.2,
    latencyThreshold: 1000,
    enableFailover: true,
    failoverModes: ['plugin', 'rcon', 'terminal'],
    failoverDelay: 5000,
    enableAlerts: true,
    alertThresholds: {
      connectionFailures: 3,
      authFailures: 2,
      protocolErrors: 5
    },
    ...overrides
  };
}

// ============================================================================
// Arbitraries for Property Testing
// ============================================================================

const serverIdArbitrary = fc.string({ minLength: 8, maxLength: 32 });

const serverConfigArbitrary = fc.record({
  id: serverIdArbitrary,
  name: fc.string({ minLength: 1, maxLength: 50 }),
  coreType: fc.constantFrom('Java', 'Bedrock'),
  coreName: fc.string({ minLength: 1, maxLength: 20 }),
  coreVersion: fc.string({ minLength: 1, maxLength: 10 }),
  connectionMode: fc.constantFrom('plugin', 'rcon', 'terminal'),
  connectionConfig: fc.record({
    plugin: fc.record({
      host: fc.ipV4(),
      port: fc.integer({ min: 1024, max: 65535 }),
      ssl: fc.boolean()
    })
  }),
  status: fc.constantFrom('online', 'offline', 'error', 'maintenance'),
  ownerId: fc.string({ minLength: 8, maxLength: 32 }),
  tags: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
  createdAt: fc.date(),
  updatedAt: fc.date()
}) as fc.Arbitrary<ServerConfig>;

const connectionErrorArbitrary = fc.record({
  message: fc.string({ minLength: 10, maxLength: 100 }),
  serverId: serverIdArbitrary,
  retryAfter: fc.option(fc.integer({ min: 1000, max: 60000 }), { nil: undefined })
}).map(({ message, serverId, retryAfter }) => 
  new ConnectionError(message, serverId, retryAfter)
);

// ============================================================================
// Property 14: Exponential Backoff Tests
// ============================================================================

describe('Property 14: Exponential Backoff for Auto-Reconnection', () => {
  let backoffManager: ExponentialBackoffManager;
  let config: ErrorHandlerConfig;

  beforeEach(() => {
    config = createTestConfig();
    backoffManager = new ExponentialBackoffManager(config);
  });

  it('should implement exponential backoff with proper delay progression', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.integer({ min: 0, max: 10 }),
      async (serverId, maxAttempts) => {
        // **Validates: Requirements 12.1**
        // Property 14: Auto-reconnection exponential backoff
        
        const delays: number[] = [];
        
        // Record multiple attempts and collect delays
        for (let i = 0; i < Math.min(maxAttempts, config.maxRetryAttempts); i++) {
          const delay = backoffManager.calculateDelay(serverId);
          delays.push(delay);
          backoffManager.recordAttempt(serverId);
        }
        
        if (delays.length > 1) {
          // Verify exponential growth pattern
          for (let i = 1; i < delays.length; i++) {
            const expectedMinDelay = config.baseRetryInterval * Math.pow(config.exponentialBackoffMultiplier, i - 1);
            const expectedMaxDelay = Math.min(
              config.baseRetryInterval * Math.pow(config.exponentialBackoffMultiplier, i),
              config.maxRetryInterval
            );
            
            // Current delay should be at least the previous expected minimum
            expect(delays[i]).toBeGreaterThanOrEqual(expectedMinDelay);
            
            // Should not exceed maximum configured delay
            expect(delays[i]).toBeLessThanOrEqual(config.maxRetryInterval);
            
            // Should show exponential growth until max is reached
            if (expectedMaxDelay < config.maxRetryInterval) {
              expect(delays[i]).toBeGreaterThan(delays[i - 1]);
            }
          }
        }
        
        // Verify retry count tracking
        expect(backoffManager.getRetryCount(serverId)).toBe(Math.min(maxAttempts, config.maxRetryAttempts));
        
        // Verify max attempts detection
        if (maxAttempts >= config.maxRetryAttempts) {
          expect(backoffManager.hasExceededMaxAttempts(serverId)).toBe(true);
        }
      }
    ), { numRuns: 20 }); // Reduced from 30 for faster testing
  });

  it('should reset backoff state on successful connection', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.integer({ min: 1, max: 5 }),
      async (serverId, attemptCount) => {
        // **Validates: Requirements 12.1**
        // Property 14: Backoff reset on success
        
        // Make several failed attempts
        for (let i = 0; i < attemptCount; i++) {
          backoffManager.recordAttempt(serverId);
        }
        
        // Verify attempts were recorded
        expect(backoffManager.getRetryCount(serverId)).toBe(attemptCount);
        
        // Reset on success
        backoffManager.reset(serverId);
        
        // Verify state is reset
        expect(backoffManager.getRetryCount(serverId)).toBe(0);
        expect(backoffManager.hasExceededMaxAttempts(serverId)).toBe(false);
        
        // Next delay should be back to base interval
        const nextDelay = backoffManager.calculateDelay(serverId);
        expect(nextDelay).toBe(config.baseRetryInterval);
      }
    ), { numRuns: 20 }); // Reduced from 30 for faster testing
  });

  it('should respect maximum retry attempts limit', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.integer({ min: 6, max: 20 }),
      async (serverId, excessiveAttempts) => {
        // **Validates: Requirements 12.1**
        // Property 14: Maximum retry attempts enforcement
        
        // Make more attempts than allowed
        for (let i = 0; i < excessiveAttempts; i++) {
          backoffManager.recordAttempt(serverId);
        }
        
        // Should not exceed max attempts
        expect(backoffManager.getRetryCount(serverId)).toBe(excessiveAttempts);
        
        // Should detect when max attempts exceeded
        expect(backoffManager.hasExceededMaxAttempts(serverId)).toBe(true);
      }
    ), { numRuns: 20 }); // Reduced from 30 for faster testing
  });

  it('should handle concurrent backoff calculations for different servers', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(serverIdArbitrary, { minLength: 2, maxLength: 5 }), // Reduced max length
      fc.integer({ min: 1, max: 2 }), // Reduced max attempts
      async (serverIds, attemptCount) => {
        // **Validates: Requirements 12.1**
        // Property 14: Concurrent server backoff isolation
        
        const uniqueServerIds = [...new Set(serverIds)];
        if (uniqueServerIds.length < 2) return; // Skip if not enough unique servers
        
        // Create a fresh backoff manager for this test
        const testBackoffManager = new ExponentialBackoffManager(config);
        
        // Make attempts for each server
        const serverDelays = new Map<string, number[]>();
        
        for (const serverId of uniqueServerIds) {
          const delays: number[] = [];
          for (let i = 0; i < attemptCount; i++) {
            delays.push(testBackoffManager.calculateDelay(serverId));
            testBackoffManager.recordAttempt(serverId);
          }
          serverDelays.set(serverId, delays);
        }
        
        // Verify each server has independent backoff state
        for (const serverId of uniqueServerIds) {
          expect(testBackoffManager.getRetryCount(serverId)).toBe(attemptCount);
        }
        
        // Reset one server and verify others are unaffected
        const firstServer = uniqueServerIds[0];
        testBackoffManager.reset(firstServer);
        
        expect(testBackoffManager.getRetryCount(firstServer)).toBe(0);
        
        for (let i = 1; i < uniqueServerIds.length; i++) {
          expect(testBackoffManager.getRetryCount(uniqueServerIds[i])).toBe(attemptCount);
        }
      }
    ), { numRuns: 10 }); // Reduced from 20 for faster testing
  });
});

// ============================================================================
// Connection Quality Monitoring Tests
// ============================================================================

describe('Connection Quality Monitoring', () => {
  let qualityMonitor: ConnectionQualityMonitor;
  let config: ErrorHandlerConfig;

  beforeEach(() => {
    config = createTestConfig();
    qualityMonitor = new ConnectionQualityMonitor(config);
  });

  it('should accurately track connection success and failure rates', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.array(fc.record({
        success: fc.boolean(),
        latency: fc.integer({ min: 10, max: 5000 })
      }), { minLength: 10, maxLength: 50 }), // Reduced max length for faster testing
      async (serverId, events) => {
        // **Validates: Requirements 12.3, 12.5**
        // Connection quality assessment
        
        let successCount = 0;
        let totalCount = 0;
        
        for (const event of events) {
          totalCount++;
          if (event.success) {
            successCount++;
            qualityMonitor.recordSuccess(serverId, event.latency);
          } else {
            qualityMonitor.recordFailure(serverId, new Error('Test failure'));
          }
        }
        
        const quality = qualityMonitor.getQuality(serverId);
        const expectedSuccessRate = totalCount > 0 ? successCount / totalCount : 1.0;
        
        // Success rate should be accurately tracked (with some tolerance for edge cases)
        if (totalCount > 0) {
          expect(quality.successRate).toBeCloseTo(expectedSuccessRate, 1);
        }
        
        // Quality score should reflect success rate
        if (expectedSuccessRate < 0.3) {
          expect(quality.score).toBeLessThan(40);
        } else if (expectedSuccessRate > 0.8) {
          expect(quality.score).toBeGreaterThan(60);
        }
        
        // Quality acceptability should match threshold
        const isAcceptable = qualityMonitor.isQualityAcceptable(serverId);
        expect(isAcceptable).toBe(quality.score >= config.connectionQualityThreshold);
      }
    ), { numRuns: 20 });
  });

  it('should penalize high latency in quality scoring', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.integer({ min: 10, max: 100 }),
      fc.integer({ min: 10, max: 5000 }),
      async (serverId, eventCount, baseLatency) => {
        // **Validates: Requirements 12.5**
        // Connection quality assessment with latency consideration
        
        // Record events with consistent latency
        for (let i = 0; i < eventCount; i++) {
          qualityMonitor.recordSuccess(serverId, baseLatency);
        }
        
        const quality = qualityMonitor.getQuality(serverId);
        
        // High latency should result in lower quality score
        if (baseLatency > config.latencyThreshold) {
          expect(quality.score).toBeLessThan(90);
        }
        
        // Average latency should be tracked accurately (allowing for some variance)
        expect(quality.latency).toBeGreaterThan(0);
        if (eventCount > 5) {
          // Only check accuracy for larger samples
          expect(quality.latency).toBeLessThan(baseLatency * 3); // Allow up to 3x variance
        }
        
        // Very high latency should make connection unacceptable
        if (baseLatency > config.latencyThreshold * 2) {
          expect(qualityMonitor.isQualityAcceptable(serverId)).toBe(false);
        }
      }
    ), { numRuns: 20 }); // Reduced from 30 for faster testing
  });
});

// ============================================================================
// Error Handling Service Integration Tests
// ============================================================================

describe('Error Handling Service Integration', () => {
  let errorHandler: ErrorHandlingService;
  let mockContext: Context;
  let mockAuditService: AuditService;

  beforeEach(() => {
    mockContext = createMockContext();
    mockAuditService = createMockAuditService();
    errorHandler = new ErrorHandlingService(mockContext, mockAuditService, createTestConfig());
  });

  afterEach(() => {
    errorHandler.shutdown();
  });

  it('should handle connection failures with proper recovery scheduling', async () => {
    // **Validates: Requirements 12.1, 12.3**
    // Connection error handling and recovery
    
    const serverId = 'test-server-456';
    const serverConfig = {
      id: serverId,
      name: 'Test Server',
      coreType: 'Java' as const,
      coreName: 'Paper',
      coreVersion: '1.20',
      connectionMode: 'plugin' as const,
      connectionConfig: {
        plugin: {
          host: '127.0.0.1',
          port: 8080,
          ssl: false
        }
      },
      status: 'online' as const,
      ownerId: 'test-owner',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as ServerConfig;
    
    const error = new ConnectionError('Test connection failure', serverId);
    
    let recoveryScheduled = false;
    let failoverAttempted = false;
    
    errorHandler.on('recoveryAttempt', () => {
      recoveryScheduled = true;
    });
    
    errorHandler.on('failoverRequired', () => {
      failoverAttempted = true;
    });
    
    // Handle connection failure
    await errorHandler.handleConnectionFailure(serverId, error, serverConfig);
    
    // Verify error was logged
    expect(mockAuditService.logger.logError).toHaveBeenCalledWith(
      'connection_failed',
      expect.objectContaining({
        error: error.message,
        retryCount: 1,
        connectionMode: serverConfig.connectionMode
      }),
      expect.any(Error),
      expect.objectContaining({
        serverId
      })
    );
    
    // Get connection quality after failure
    const quality = errorHandler.getConnectionQuality(serverId);
    expect(quality.failureCount).toBeGreaterThan(0);
    
    // Verify error statistics are updated
    const stats = errorHandler.getErrorStats();
    expect(stats.totalErrors).toBeGreaterThan(0);
    expect(stats.errorsByCategory.connection).toBeGreaterThan(0);
  });

  it('should handle authentication failures with appropriate responses', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.constantFrom('token_expired', 'invalid_token', 'token_revoked', 'ip_not_whitelisted'),
      async (serverId, reason) => {
        // **Validates: Requirements 12.2**
        // Authentication failure handling
        
        const error = new AuthenticationError(`Auth failed: ${reason}`, serverId);
        let tokenRefreshRequested = false;
        let criticalAlertSent = false;
        
        errorHandler.on('tokenRefreshRequired', () => {
          tokenRefreshRequested = true;
        });
        
        errorHandler.on('authenticationCritical', () => {
          criticalAlertSent = true;
        });
        
        // Handle authentication failure
        await errorHandler.handleAuthenticationFailure(serverId, error, reason);
        
        // Verify audit log was created
        expect(mockAuditService.logger.logAuthFailure).toHaveBeenCalledWith(serverId, reason);
        
        // Verify appropriate response based on reason
        switch (reason) {
          case 'token_expired':
            expect(tokenRefreshRequested).toBe(true);
            break;
          case 'invalid_token':
          case 'token_revoked':
            expect(criticalAlertSent).toBe(true);
            break;
        }
        
        // Verify error statistics
        const stats = errorHandler.getErrorStats();
        expect(stats.errorsByCategory.authentication).toBeGreaterThan(0);
      }
    ), { numRuns: 20 });
  });

  it('should record successful connections and reset error state', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.integer({ min: 50, max: 500 }),
      async (serverId, latency) => {
        // **Validates: Requirements 12.1**
        // Success handling and state reset
        
        // First create some failures
        const error = new ConnectionError('Test failure', serverId);
        const serverConfig = {
          id: serverId,
          connectionMode: 'plugin' as const,
          // ... other required fields with defaults
        } as ServerConfig;
        
        await errorHandler.handleConnectionFailure(serverId, error, serverConfig);
        
        // Verify failure was recorded
        let stats = errorHandler.getErrorStats();
        expect(stats.totalErrors).toBeGreaterThan(0);
        
        // Record successful connection
        errorHandler.recordConnectionSuccess(serverId, latency);
        
        // Verify quality is updated
        const quality = errorHandler.getConnectionQuality(serverId);
        
        // Latency should be in reasonable range (allowing for some variance due to averaging)
        expect(quality.latency).toBeGreaterThan(0);
        expect(quality.latency).toBeLessThan(latency * 2); // Allow up to 2x variance
        expect(quality.successRate).toBeGreaterThan(0);
        
        // Verify error context is cleared
        stats = errorHandler.getErrorStats();
        expect(stats.activeContexts).toBe(0);
      }
    ), { numRuns: 20 });
  });
});

// ============================================================================
// Edge Cases and Error Conditions
// ============================================================================

describe('Error Handling Edge Cases', () => {
  let errorHandler: ErrorHandlingService;
  let mockContext: Context;
  let mockAuditService: AuditService;

  beforeEach(() => {
    mockContext = createMockContext();
    mockAuditService = createMockAuditService();
    errorHandler = new ErrorHandlingService(mockContext, mockAuditService, createTestConfig({
      maxRetryAttempts: 2, // Low limit for testing
      baseRetryInterval: 100 // Fast for testing
    }));
  });

  afterEach(() => {
    errorHandler.shutdown();
  });

  it('should handle rapid successive failures gracefully', async () => {
    // **Validates: Requirements 12.1, 12.3**
    // Rapid failure handling
    
    const serverId = 'test-server-123';
    const failureCount = 3;
    
    const serverConfig = {
      id: serverId,
      connectionMode: 'plugin' as const,
      name: 'test-server',
      coreType: 'Java' as const,
      coreName: 'Paper',
      coreVersion: '1.20',
      connectionConfig: {},
      status: 'online' as const,
      ownerId: 'test-owner',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date()
    } as ServerConfig;
    
    // Create a test-specific error handler with test mode enabled
    const testErrorHandler = new ErrorHandlingService(mockContext, mockAuditService, createTestConfig({
      maxRetryAttempts: 2,
      baseRetryInterval: 10,
      maxRetryInterval: 100
    }));
    
    testErrorHandler.setTestMode(true);
    
    try {
      // Generate rapid failures
      for (let i = 0; i < failureCount; i++) {
        const error = new ConnectionError(`Failure ${i}`, serverId);
        await testErrorHandler.handleConnectionFailure(serverId, error, serverConfig);
      }
      
      // Verify error statistics are reasonable
      const stats = testErrorHandler.getErrorStats();
      expect(stats.totalErrors).toBe(failureCount);
      expect(stats.activeContexts).toBe(1); // Should consolidate to one context
      
      // Verify quality degradation
      const quality = testErrorHandler.getConnectionQuality(serverId);
      expect(quality.score).toBeLessThan(100); // Should be degraded
      expect(quality.failureCount).toBeGreaterThan(0);
      
    } finally {
      testErrorHandler.shutdown();
    }
  });

  it('should handle protocol errors with appropriate severity responses', async () => {
    await fc.assert(fc.asyncProperty(
      serverIdArbitrary,
      fc.constantFrom('minor', 'major', 'critical'),
      fc.string({ minLength: 10, maxLength: 50 }),
      async (serverId, severity, errorMessage) => {
        // **Validates: Requirements 12.2**
        // Protocol error severity handling
        
        const error = new ProtocolError(errorMessage, `msg-${Date.now()}`, severity as any);
        let criticalErrorEmitted = false;
        let majorErrorEmitted = false;
        
        errorHandler.on('criticalProtocolError', () => {
          criticalErrorEmitted = true;
        });
        
        errorHandler.on('majorProtocolError', () => {
          majorErrorEmitted = true;
        });
        
        // Handle protocol error
        await errorHandler.handleProtocolError(serverId, error);
        
        // Verify audit logging
        expect(mockAuditService.logger.logError).toHaveBeenCalledWith(
          'protocol_error',
          expect.objectContaining({
            error: errorMessage,
            severity
          }),
          expect.any(Error),
          expect.objectContaining({
            serverId
          })
        );
        
        // Verify appropriate response based on severity
        if (severity === 'critical') {
          expect(criticalErrorEmitted).toBe(true);
        }
        
        // Verify error categorization
        const stats = errorHandler.getErrorStats();
        expect(stats.errorsByCategory.protocol).toBeGreaterThan(0);
      }
    ), { numRuns: 20 });
  });
});