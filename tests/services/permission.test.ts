/**
 * Mochi-Link (大福连) - Permission Management Tests
 * 
 * Unit tests for the permission management system
 */

import { Context } from 'koishi';
import { PermissionManager, DEFAULT_ROLES } from '../../src/services/permission';
import { PermissionDeniedError } from '../../src/types';

// Mock Koishi context
const mockContext = {
  logger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  })),
  database: {
    get: jest.fn(),
    create: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    getUser: jest.fn(),
    setUser: jest.fn()
  }
} as unknown as Context;

describe('PermissionManager', () => {
  let permissionManager: PermissionManager;

  beforeEach(() => {
    jest.clearAllMocks();
    permissionManager = new PermissionManager(mockContext);
  });

  describe('Role Definitions', () => {
    test('should have default roles defined', () => {
      const roles = permissionManager.getAllRoleDefinitions();
      
      expect(roles.has('owner')).toBe(true);
      expect(roles.has('admin')).toBe(true);
      expect(roles.has('moderator')).toBe(true);
      expect(roles.has('viewer')).toBe(true);
    });

    test('should allow custom role definition', () => {
      const customRole = {
        name: 'custom' as any,
        permissions: ['server.view', 'player.view'],
        description: 'Custom role for testing'
      };

      permissionManager.defineRole('custom' as any, customRole);
      const definition = permissionManager.getRoleDefinition('custom' as any);
      
      expect(definition).toEqual(customRole);
    });
  });

  describe('Permission Format Validation', () => {
    test('should validate correct permission formats', () => {
      expect(permissionManager.validatePermissionFormat('server1.manage')).toBe(true);
      expect(permissionManager.validatePermissionFormat('*')).toBe(true);
      expect(permissionManager.validatePermissionFormat('test.server.complex.operation')).toBe(true);
    });

    test('should reject invalid permission formats', () => {
      expect(permissionManager.validatePermissionFormat('invalid')).toBe(false);
      expect(permissionManager.validatePermissionFormat('')).toBe(false);
      expect(permissionManager.validatePermissionFormat('.')).toBe(false);
    });
  });
});