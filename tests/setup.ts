/**
 * Test Setup Configuration
 * 
 * This file configures the testing environment for Mochi-Link plugin tests.
 */

import { Context } from 'koishi';

// Mock Koishi context for testing
export function createMockContext(): Context {
  const mockContext = {
    logger: jest.fn(() => ({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn()
    })),
    database: {
      get: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue([{ id: 1 }]),
      set: jest.fn().mockResolvedValue({ matched: 1, modified: 1 }),
      upsert: jest.fn().mockResolvedValue({ matched: 1, modified: 1 }),
      remove: jest.fn().mockResolvedValue({ matched: 1 }),
      query: jest.fn(),
      prepare: jest.fn(),
      drop: jest.fn()
    },
    model: {
      extend: jest.fn()
    }
  } as any;

  return mockContext;
}

// Global test configuration
beforeEach(() => {
  jest.clearAllMocks();
});

// Increase timeout for property-based tests
jest.setTimeout(30000);