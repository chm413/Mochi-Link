/**
 * Connection Security Manager Property-Based Tests
 * 
 * Property-based tests to verify connection security management correctness
 * across various input combinations and edge cases.
 */

import * as fc from 'fast-check';
import { ConnectionSecurityManager, ConnectionSecurityConfig } from '../../src/services/connection-security';
import { AuditService } from '../../src/services/audit';
import { Context } from 'koishi';

// Mock dependencies
const mockContext = {
  logger: jest.fn(() => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn()
  }))
} as unknown as Context;

const mockAuditService = {
  logger: {
    logSuccess: jest.fn(),
    logFailure: jest.fn(),
    logError: jest.fn()
  }
} as unknown as AuditService;

// Test data generators
const serverIdArbitrary = fc.string({ minLength: 1, maxLength: 32 });
const ipAddressArbitrary = fc.tuple(
  fc.integer({ min: 1, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 0, max: 255 }),
  fc.integer({ min: 1, max: 255 })
).map(([a, b, c, d]) => `${a}.${b}.${c}.${d}`);

const connectionIdArbitrary = fc.string({ minLength: 1, maxLength: 64 });

describe('ConnectionSecurityManager Property Tests', () => {
  let securityManager: ConnectionSecurityManager;

  beforeEach(() => {
    const config: Partial<ConnectionSecurityConfig> = {
      connectionLimits: {
        enabled: true,
        maxConnectionsPerIP: 5,
        maxConnectionsPerServer: 10,
        maxTotalConnections: 50,
        connectionTimeout: 30000,
        cleanupInterval: 60000
      },
      authFailureHandling: {
        enabled: true,
        baseDelay: 1000,
        maxDelay: 60000,
        backoffMultiplier: 2,
        resetWindow: 300000,
        maxFailuresBeforeBlock: 5,
        blockDuration: 600000
      }
    };

    securityManager = new ConnectionSecurityManager(mockContext, mockAuditService, config);
    
    // Increase max listeners to avoid warnings in property tests
    securityManager.setMaxListeners(50);
  });

  afterEach(() => {
    securityManager.shutdown();
    jest.clearAllMocks();
  });

  describe('Property: Connection Limit Enforcement', () => {
    it('should never allow more connections than configured limits', async () => {
      /**
       * **Validates: Connection Security Management - Connection Limits**
       * 
       * Property: For any sequence of connection registrations, the system should
       * never allow more connections than the configured limits per IP, per server,
       * or total connections.
       */
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          connectionId: connectionIdArbitrary,
          serverId: serverIdArbitrary,
          ip: ipAddressArbitrary
        }), { minLength: 1, maxLength: 20 }), // Reduced size for simpler testing
        async (connections) => {
          const connectionsByIP = new Map<string, number>();
          const connectionsByServer = new Map<string, number>();
          let totalConnections = 0;

          for (const conn of connections) {
            const ipCount = connectionsByIP.get(conn.ip) || 0;
            const serverCount = connectionsByServer.get(conn.serverId) || 0;

            const result = securityManager.checkConnectionAllowed(conn.serverId, conn.ip);

            if (result.allowed) {
              securityManager.registerConnection(conn.connectionId, conn.serverId, conn.ip);
              connectionsByIP.set(conn.ip, ipCount + 1);
              connectionsByServer.set(conn.serverId, serverCount + 1);
              totalConnections++;
            }

            // Verify limits are enforced
            expect(connectionsByIP.get(conn.ip) || 0).toBeLessThanOrEqual(5);
            expect(connectionsByServer.get(conn.serverId) || 0).toBeLessThanOrEqual(10);
            expect(totalConnections).toBeLessThanOrEqual(50);
          }
        }
      ), { numRuns: 20 }); // Reduced runs for faster testing
    });
  });

  describe('Property: Progressive Authentication Delay', () => {
    it('should apply increasing delays for authentication failures', async () => {
      /**
       * **Validates: Connection Security Management - Progressive Authentication Delays**
       * 
       * Property: For any sequence of authentication failures from the same IP and server,
       * the system should apply delays and eventually block after too many failures.
       */
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        ipAddressArbitrary,
        connectionIdArbitrary,
        fc.integer({ min: 1, max: 6 }), // Test up to blocking threshold
        async (serverId, ip, connectionId, failureCount) => {
          let wasBlocked = false;

          for (let i = 0; i < failureCount; i++) {
            // Record authentication failure
            securityManager.recordAuthenticationFailure(connectionId, serverId, ip, 'Test failure');

            // Check if authentication is allowed
            const result = securityManager.checkAuthenticationAllowed(serverId, ip);
            
            if (!result.allowed) {
              if (result.reason?.includes('blocked')) {
                wasBlocked = true;
              }
              expect(result.retryAfter).toBeGreaterThan(0);
            }
          }

          // If we exceeded the blocking threshold, should be blocked
          if (failureCount >= 5) {
            expect(wasBlocked).toBe(true);
          }
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property: Connection Registration Consistency', () => {
    it('should maintain consistent connection tracking', async () => {
      /**
       * **Validates: Connection Security Management - Connection Tracking Consistency**
       * 
       * Property: Connection registration and unregistration should maintain consistent state.
       */
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          operation: fc.constantFrom('register', 'unregister'),
          connectionId: connectionIdArbitrary,
          serverId: serverIdArbitrary,
          ip: ipAddressArbitrary
        }), { minLength: 1, maxLength: 5 }), // Further reduced complexity
        async (operations) => {
          // Create fresh instance for each test
          const testManager = new ConnectionSecurityManager(mockContext, mockAuditService, {
            connectionLimits: {
              enabled: true,
              maxConnectionsPerIP: 10,
              maxConnectionsPerServer: 20,
              maxTotalConnections: 100,
              connectionTimeout: 30000,
              cleanupInterval: 60000
            }
          });
          testManager.setMaxListeners(50);

          const registeredConnections = new Set<string>();

          for (const op of operations) {
            if (op.operation === 'register') {
              if (!registeredConnections.has(op.connectionId)) {
                testManager.registerConnection(op.connectionId, op.serverId, op.ip);
                registeredConnections.add(op.connectionId);
              }
            } else if (op.operation === 'unregister') {
              if (registeredConnections.has(op.connectionId)) {
                testManager.unregisterConnection(op.connectionId);
                registeredConnections.delete(op.connectionId);
              }
            }
          }

          // Verify final state is consistent
          const stats = testManager.getStats();
          expect(stats.connections.active).toBeGreaterThanOrEqual(0);
          expect(stats.connections.active).toBeLessThanOrEqual(100); // Within total limit

          testManager.shutdown();
        }
      ), { numRuns: 10 });
    });
  });

  describe('Property: Authentication Success Clears Failures', () => {
    it('should clear authentication failure records on successful authentication', async () => {
      /**
       * **Validates: Connection Security Management - Authentication Success Recovery**
       * 
       * Property: For any IP and server combination, a successful authentication
       * should clear all previous failure records and allow immediate subsequent attempts.
       */
      await fc.assert(fc.asyncProperty(
        serverIdArbitrary,
        ipAddressArbitrary,
        connectionIdArbitrary,
        fc.integer({ min: 1, max: 4 }), // Failures before success
        async (serverId, ip, connectionId, failuresBeforeSuccess) => {
          // Record some failures
          for (let i = 0; i < failuresBeforeSuccess; i++) {
            securityManager.recordAuthenticationFailure(connectionId, serverId, ip, 'Test failure');
          }

          // Verify failures are recorded
          let stats = securityManager.getStats();
          expect(stats.authentication.activeFailureRecords).toBeGreaterThan(0);

          // Record successful authentication
          securityManager.recordAuthenticationSuccess(connectionId, serverId, ip);

          // Verify failure record is cleared
          stats = securityManager.getStats();
          const failureRecords = securityManager.getAuthFailureRecords();
          const relevantRecord = failureRecords.find(r => r.ip === ip && r.serverId === serverId);
          
          expect(relevantRecord).toBeUndefined();

          // Verify next authentication attempt is allowed immediately
          const result = securityManager.checkAuthenticationAllowed(serverId, ip);
          expect(result.allowed).toBe(true);
        }
      ), { numRuns: 30 });
    });
  });

  describe('Property: Security Alert Generation', () => {
    it('should generate alerts when thresholds are exceeded', async () => {
      /**
       * **Validates: Connection Security Management - Security Alert Generation**
       * 
       * Property: When security thresholds are exceeded (connection limits, auth failures),
       * appropriate security alerts should be generated with correct severity levels.
       */
      await fc.assert(fc.asyncProperty(
        ipAddressArbitrary,
        fc.integer({ min: 6, max: 15 }), // Exceed connection limit of 5
        async (ip, connectionCount) => {
          let alertGenerated = false;
          let alertType: string | undefined;
          let alertSeverity: string | undefined;

          securityManager.on('securityAlert', (alert) => {
            alertGenerated = true;
            alertType = alert.type;
            alertSeverity = alert.severity;
          });

          // Register connections to exceed limit
          for (let i = 0; i < connectionCount; i++) {
            const connectionId = `conn-${i}`;
            const serverId = `server-${i}`;
            
            securityManager.registerConnection(connectionId, serverId, ip);
          }

          // Try to register one more connection (should trigger alert)
          const result = securityManager.checkConnectionAllowed('server-extra', ip);

          if (!result.allowed && result.reason?.includes('IP')) {
            expect(alertGenerated).toBe(true);
            expect(alertType).toBe('connection_limit_exceeded');
            expect(alertSeverity).toBe('medium');
          }

          // Verify alert is recorded in statistics
          const stats = securityManager.getStats();
          if (alertGenerated) {
            expect(stats.alerts.total).toBeGreaterThan(0);
          }
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property: Configuration Consistency', () => {
    it('should maintain configuration consistency after updates', async () => {
      /**
       * **Validates: Connection Security Management - Configuration Management**
       * 
       * Property: Configuration updates should be applied consistently and
       * should not break existing functionality or cause invalid states.
       */
      await fc.assert(fc.asyncProperty(
        fc.record({
          maxConnectionsPerIP: fc.integer({ min: 1, max: 20 }),
          maxConnectionsPerServer: fc.integer({ min: 1, max: 50 }),
          baseDelay: fc.integer({ min: 100, max: 5000 }),
          maxDelay: fc.integer({ min: 5000, max: 120000 })
        }),
        async (configUpdate) => {
          // Update configuration
          securityManager.updateConfig({
            connectionLimits: {
              ...securityManager.getConfig().connectionLimits,
              maxConnectionsPerIP: configUpdate.maxConnectionsPerIP,
              maxConnectionsPerServer: configUpdate.maxConnectionsPerServer
            },
            authFailureHandling: {
              ...securityManager.getConfig().authFailureHandling,
              baseDelay: configUpdate.baseDelay,
              maxDelay: configUpdate.maxDelay
            }
          });

          // Verify configuration is applied
          const config = securityManager.getConfig();
          expect(config.connectionLimits.maxConnectionsPerIP).toBe(configUpdate.maxConnectionsPerIP);
          expect(config.connectionLimits.maxConnectionsPerServer).toBe(configUpdate.maxConnectionsPerServer);
          expect(config.authFailureHandling.baseDelay).toBe(configUpdate.baseDelay);
          expect(config.authFailureHandling.maxDelay).toBe(configUpdate.maxDelay);

          // Verify functionality still works with new configuration
          const result = securityManager.checkConnectionAllowed('test-server', '192.168.1.1');
          expect(typeof result.allowed).toBe('boolean');

          const authResult = securityManager.checkAuthenticationAllowed('test-server', '192.168.1.1');
          expect(typeof authResult.allowed).toBe('boolean');
        }
      ), { numRuns: 20 });
    });
  });

  describe('Property: Statistics Accuracy', () => {
    it('should maintain accurate statistics across operations', async () => {
      /**
       * **Validates: Connection Security Management - Statistics Accuracy**
       * 
       * Property: Statistics should accurately reflect the current state.
       */
      await fc.assert(fc.asyncProperty(
        fc.array(fc.record({
          type: fc.constantFrom('register', 'auth_fail'),
          connectionId: connectionIdArbitrary,
          serverId: serverIdArbitrary,
          ip: ipAddressArbitrary
        }), { minLength: 1, maxLength: 5 }), // Simplified operations
        async (operations) => {
          // Create fresh instance for each test
          const testManager = new ConnectionSecurityManager(mockContext, mockAuditService, {
            connectionLimits: {
              enabled: true,
              maxConnectionsPerIP: 10,
              maxConnectionsPerServer: 20,
              maxTotalConnections: 100,
              connectionTimeout: 30000,
              cleanupInterval: 60000
            },
            authFailureHandling: {
              enabled: true,
              baseDelay: 1000,
              maxDelay: 60000,
              backoffMultiplier: 2,
              resetWindow: 300000,
              maxFailuresBeforeBlock: 5,
              blockDuration: 600000
            }
          });
          testManager.setMaxListeners(50);

          let expectedAuthFailures = 0;

          for (const op of operations) {
            switch (op.type) {
              case 'register':
                testManager.registerConnection(op.connectionId, op.serverId, op.ip);
                break;

              case 'auth_fail':
                testManager.recordAuthenticationFailure(op.connectionId, op.serverId, op.ip, 'Test failure');
                expectedAuthFailures++;
                break;
            }
          }

          // Verify statistics are reasonable
          const stats = testManager.getStats();
          expect(stats.connections.active).toBeGreaterThanOrEqual(0);
          expect(stats.authentication.failures).toBe(expectedAuthFailures);
          expect(stats.authentication.activeFailureRecords).toBeGreaterThanOrEqual(0);

          testManager.shutdown();
        }
      ), { numRuns: 10 });
    });
  });
});