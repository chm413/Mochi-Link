/**
 * Main Plugin Tests
 * 
 * This file contains tests for the main plugin functionality.
 */

import { Context } from 'koishi';
import MochiLinkPlugin, { Config } from '../src/index';
import { createMockContext } from './setup';

describe('MochiLinkPlugin', () => {
  let ctx: Context;
  let plugin: MochiLinkPlugin;
  let config: any;

  beforeEach(() => {
    ctx = createMockContext();
    config = {
      websocket: {
        port: 8080,
        host: '127.0.0.1'
      },
      database: {
        prefix: 'test_'
      },
      security: {
        tokenExpiry: 3600,
        maxConnections: 10,
        rateLimiting: {
          windowMs: 60000,
          maxRequests: 100
        }
      },
      monitoring: {
        reportInterval: 30,
        historyRetention: 7
      },
      logging: {
        level: 'info' as const,
        auditRetention: 30
      }
    };
  });

  afterEach(() => {
    if (plugin) {
      plugin.stop();
    }
  });

  describe('Plugin Initialization', () => {
    it('should create plugin instance with valid config', () => {
      plugin = new MochiLinkPlugin(ctx, config);
      
      expect(plugin).toBeInstanceOf(MochiLinkPlugin);
      expect(plugin.config).toEqual(config);
    });

    it('should have correct service injection requirements', () => {
      expect(MochiLinkPlugin.inject).toEqual(['database']);
    });
  });

  describe('Plugin API', () => {
    beforeEach(() => {
      plugin = new MochiLinkPlugin(ctx, config);
    });

    it('should return health status', () => {
      const health = plugin.getHealth();
      
      expect(health).toHaveProperty('status');
      expect(health).toHaveProperty('initialized');
      expect(health).toHaveProperty('uptime');
      expect(health.status).toBe('initializing'); // Before start() is called
      expect(health.initialized).toBe(false);
      expect(typeof health.uptime).toBe('number');
    });

    it('should return plugin configuration', () => {
      const returnedConfig = plugin.getConfig();
      
      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // Should be a copy
    });
  });

  describe('Configuration Schema', () => {
    it('should process valid configuration', () => {
      const validConfig = {
        websocket: { port: 8080, host: '127.0.0.1' },
        database: { prefix: 'test_' },
        security: {
          tokenExpiry: 3600,
          maxConnections: 50,
          rateLimiting: { windowMs: 60000, maxRequests: 100 }
        },
        monitoring: { reportInterval: 30, historyRetention: 30 },
        logging: { level: 'debug' as const, auditRetention: 90 }
      };

      // Test that the config can be processed without throwing
      expect(() => {
        const result = Config(validConfig);
        expect(result).toBeDefined();
        expect(result.websocket.port).toBe(8080);
        expect(result.database.prefix).toBe('test_');
      }).not.toThrow();
    });

    it('should apply default values', () => {
      const minimalConfig = {
        websocket: { port: 8080, host: '127.0.0.1' },
        database: { prefix: 'test_' },
        security: {
          tokenExpiry: 3600,
          maxConnections: 50,
          rateLimiting: { windowMs: 60000, maxRequests: 100 }
        },
        monitoring: { reportInterval: 30, historyRetention: 30 },
        logging: { level: 'info' as const, auditRetention: 90 }
      };

      const result = Config(minimalConfig);
      expect(result.websocket.port).toBe(8080);
      expect(result.database.prefix).toBe('test_');
      expect(result.logging.level).toBe('info');
    });
  });
});