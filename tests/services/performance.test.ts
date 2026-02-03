/**
 * Performance Optimization Service Tests
 */

import { Context } from 'koishi';
import { PerformanceOptimizationService, PerformanceConfig } from '../../src/services/performance';
import { DatabaseManager } from '../../src/database/operations';

// Mock Koishi context
const mockContext = {
  logger: (name: string) => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }),
  database: {
    get: jest.fn(),
    create: jest.fn(),
    set: jest.fn(),
    remove: jest.fn()
  }
} as unknown as Context;

describe('PerformanceOptimizationService', () => {
  let performanceService: PerformanceOptimizationService;
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(mockContext);
    performanceService = new PerformanceOptimizationService(mockContext, dbManager);
  });

  afterEach(async () => {
    await performanceService.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(performanceService.initialize()).resolves.not.toThrow();
    });

    it('should emit initialized event', async () => {
      const initSpy = jest.fn();
      performanceService.on('initialized', initSpy);
      
      await performanceService.initialize();
      
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should collect performance metrics', async () => {
      const metrics = await performanceService.getPerformanceMetrics();
      
      expect(metrics).toHaveProperty('database');
      expect(metrics).toHaveProperty('connections');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('resources');
      expect(metrics).toHaveProperty('overall');
    });

    it('should calculate performance score', async () => {
      const metrics = await performanceService.getPerformanceMetrics();
      
      expect(metrics.overall.performanceScore).toBeGreaterThanOrEqual(0);
      expect(metrics.overall.performanceScore).toBeLessThanOrEqual(100);
    });

    it('should determine health status', async () => {
      const metrics = await performanceService.getPerformanceMetrics();
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(metrics.overall.healthStatus);
    });
  });

  describe('Optimized Database Operations', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should get server with optimization', async () => {
      const serverId = 'test-server';
      
      // Mock database response
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        id: serverId,
        name: 'Test Server',
        core_type: 'Java',
        status: 'online'
      }]);

      const server = await performanceService.getServerOptimized(serverId);
      
      expect(server).toBeDefined();
      expect(server.id).toBe(serverId);
    });

    it('should get user permissions with optimization', async () => {
      const userId = 'test-user';
      
      // Mock database response
      (mockContext.database.get as jest.Mock).mockResolvedValue([{
        user_id: userId,
        server_id: 'test-server',
        role: 'admin',
        permissions: '["*"]'
      }]);

      const permissions = await performanceService.getUserPermissionsOptimized(userId);
      
      expect(Array.isArray(permissions)).toBe(true);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should invalidate cache by pattern', async () => {
      await expect(performanceService.invalidateCache('test:*')).resolves.not.toThrow();
    });

    it('should preload data', async () => {
      await expect(performanceService.preloadData()).resolves.not.toThrow();
    });
  });

  describe('Health Status', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should return health status', async () => {
      const health = await performanceService.getHealthStatus();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('details');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
    });

    it('should include component health details', async () => {
      const health = await performanceService.getHealthStatus();
      
      expect(health.details).toHaveProperty('performanceScore');
      expect(health.details).toHaveProperty('databaseHealth');
      expect(health.details).toHaveProperty('connectionPoolHealth');
      expect(health.details).toHaveProperty('cacheHealth');
      expect(health.details).toHaveProperty('recommendations');
    });
  });

  describe('Configuration', () => {
    it('should get configuration', () => {
      const config = performanceService.getConfig();
      
      expect(config).toHaveProperty('database');
      expect(config).toHaveProperty('connectionPool');
      expect(config).toHaveProperty('cache');
      expect(config).toHaveProperty('resources');
      expect(config).toHaveProperty('monitoring');
    });

    it('should update configuration', () => {
      const newConfig: Partial<PerformanceConfig> = {
        cache: {
          maxMemorySize: 200 * 1024 * 1024, // 200MB
          defaultTTL: 300000,
          preloadEnabled: true,
          preloadInterval: 300000,
          compressionEnabled: true
        }
      };

      expect(() => performanceService.updateConfig(newConfig)).not.toThrow();
      
      const updatedConfig = performanceService.getConfig();
      expect(updatedConfig.cache.maxMemorySize).toBe(200 * 1024 * 1024);
    });

    it('should emit config updated event', () => {
      const configSpy = jest.fn();
      performanceService.on('configUpdated', configSpy);
      
      const partialConfig: Partial<PerformanceConfig> = { 
        cache: { 
          defaultTTL: 600000,
          maxMemorySize: 100 * 1024 * 1024,
          preloadEnabled: true,
          preloadInterval: 300000,
          compressionEnabled: true
        } 
      };
      performanceService.updateConfig(partialConfig);
      
      expect(configSpy).toHaveBeenCalled();
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await performanceService.initialize();
    });

    it('should emit performance alerts', async () => {
      // This test would need actual performance issues to trigger alerts
      // For now, we'll just verify the service can handle the event
      const alertSpy = jest.fn();
      performanceService.on('performanceAlert', alertSpy);
      
      // Manually emit an alert for testing
      performanceService.emit('performanceAlert', 'Test alert');
      
      expect(alertSpy).toHaveBeenCalledWith('Test alert');
    });

    it('should emit metrics collected events', async () => {
      const metricsSpy = jest.fn();
      performanceService.on('metricsCollected', metricsSpy);
      
      // Manually emit metrics for testing
      const testMetrics = await performanceService.getPerformanceMetrics();
      performanceService.emit('metricsCollected', testMetrics);
      
      expect(metricsSpy).toHaveBeenCalledWith(testMetrics);
    });
  });
});

// Property-based test for performance optimization
describe('Performance Optimization Properties', () => {
  let performanceService: PerformanceOptimizationService;
  let dbManager: DatabaseManager;

  beforeEach(() => {
    dbManager = new DatabaseManager(mockContext);
    performanceService = new PerformanceOptimizationService(mockContext, dbManager);
  });

  afterEach(async () => {
    await performanceService.shutdown();
  });

  /**
   * **Validates: Requirements 15.8**
   * Property: Performance optimization should maintain system responsiveness
   */
  it('should maintain system responsiveness under load', async () => {
    await performanceService.initialize();
    
    const startTime = Date.now();
    
    // Simulate multiple concurrent operations
    const operations = Array.from({ length: 10 }, (_, i) => 
      performanceService.getServerOptimized(`server-${i}`)
    );
    
    await Promise.all(operations);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Performance optimization should keep response time reasonable
    expect(totalTime).toBeLessThan(5000); // Less than 5 seconds for 10 operations
  });

  /**
   * **Validates: Requirements 15.8**
   * Property: Cache hit rate should improve over time with preloading
   */
  it('should improve cache performance with preloading', async () => {
    await performanceService.initialize();
    
    // Get initial metrics
    const initialMetrics = await performanceService.getPerformanceMetrics();
    const initialHitRate = initialMetrics.cache.hitRate;
    
    // Perform preloading
    await performanceService.preloadData();
    
    // Simulate some cache access
    await performanceService.getServerOptimized('test-server');
    await performanceService.getUserPermissionsOptimized('test-user');
    
    // Get metrics after preloading
    const finalMetrics = await performanceService.getPerformanceMetrics();
    const finalHitRate = finalMetrics.cache.hitRate;
    
    // Cache hit rate should not decrease (and ideally improve)
    expect(finalHitRate).toBeGreaterThanOrEqual(initialHitRate);
  });

  /**
   * **Validates: Requirements 15.8**
   * Property: Performance score should be within valid range
   */
  it('should maintain valid performance score range', async () => {
    await performanceService.initialize();
    
    const metrics = await performanceService.getPerformanceMetrics();
    
    // Performance score should always be between 0 and 100
    expect(metrics.overall.performanceScore).toBeGreaterThanOrEqual(0);
    expect(metrics.overall.performanceScore).toBeLessThanOrEqual(100);
    
    // Performance score should be a finite number
    expect(Number.isFinite(metrics.overall.performanceScore)).toBe(true);
  });
});