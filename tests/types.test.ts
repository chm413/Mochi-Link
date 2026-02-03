/**
 * Type Definitions Tests
 * 
 * This file contains tests for the core type definitions and interfaces.
 */

import {
  ServerConfig,
  Player,
  UWBPMessage,
  MochiLinkError,
  ConnectionError,
  PermissionDeniedError
} from '../src/types';

describe('Type Definitions', () => {
  describe('ServerConfig', () => {
    it('should have all required properties', () => {
      const config: ServerConfig = {
        id: 'test-server',
        name: 'Test Server',
        coreType: 'Java',
        coreName: 'Paper',
        coreVersion: '1.20.1',
        connectionMode: 'plugin',
        connectionConfig: {
          plugin: {
            host: '127.0.0.1',
            port: 8080,
            ssl: false
          }
        },
        status: 'offline',
        ownerId: 'user123',
        tags: ['test', 'development'],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      expect(config.id).toBe('test-server');
      expect(config.coreType).toBe('Java');
      expect(config.connectionMode).toBe('plugin');
      expect(config.tags).toContain('test');
    });
  });

  describe('Player', () => {
    it('should have all required properties', () => {
      const player: Player = {
        id: 'uuid-123',
        name: 'TestPlayer',
        displayName: 'TestPlayer',
        world: 'world',
        position: { x: 0, y: 64, z: 0 },
        ping: 50,
        isOp: false,
        permissions: ['basic.permission'],
        edition: 'Java'
      };

      expect(player.id).toBe('uuid-123');
      expect(player.name).toBe('TestPlayer');
      expect(player.edition).toBe('Java');
      expect(player.position.y).toBe(64);
    });
  });

  describe('UWBPMessage', () => {
    it('should have correct message structure', () => {
      const message: UWBPMessage = {
        type: 'request',
        id: 'msg-123',
        op: 'player.list',
        data: { limit: 10 },
        timestamp: Date.now(),
        serverId: 'server-123',
        version: '2.0'
      };

      expect(message.type).toBe('request');
      expect(message.op).toBe('player.list');
      expect(message.data).toHaveProperty('limit', 10);
    });
  });

  describe('Error Types', () => {
    it('should create MochiLinkError correctly', () => {
      const error = new MochiLinkError('Test error', 'TEST_ERROR', { detail: 'test' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.details).toEqual({ detail: 'test' });
      expect(error.name).toBe('MochiLinkError');
    });

    it('should create ConnectionError correctly', () => {
      const error = new ConnectionError('Connection failed', 'server-123', 5000);
      
      expect(error.message).toBe('Connection failed');
      expect(error.serverId).toBe('server-123');
      expect(error.retryAfter).toBe(5000);
      expect(error.name).toBe('ConnectionError');
    });

    it('should create PermissionDeniedError correctly', () => {
      const error = new PermissionDeniedError(
        'Access denied', 
        'user-123', 
        'server-123', 
        'admin.kick'
      );
      
      expect(error.message).toBe('Access denied');
      expect(error.userId).toBe('user-123');
      expect(error.serverId).toBe('server-123');
      expect(error.operation).toBe('admin.kick');
      expect(error.name).toBe('PermissionDeniedError');
    });
  });
});