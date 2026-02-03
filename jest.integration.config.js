/**
 * Jest Configuration for Integration Tests
 * 
 * Specialized configuration for running integration tests with appropriate
 * timeouts, setup, and teardown procedures.
 */

module.exports = {
  // Base configuration
  preset: 'ts-jest',
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/integration/**/*.test.ts'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/'
  ],
  
  // Module resolution
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Setup and teardown
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.ts'
  ],
  
  // Timeouts (integration tests need more time)
  testTimeout: 300000, // 5 minutes per test
  
  // Coverage settings
  collectCoverage: false, // Disable for integration tests to improve performance
  
  // Performance settings
  maxWorkers: 1, // Run integration tests sequentially to avoid port conflicts
  
  // Error handling
  detectOpenHandles: true,
  forceExit: true,
  
  // Verbose output
  verbose: true,
  
  // Transform settings
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'ts',
    'js',
    'json'
  ],
  
  // Global settings
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
      isolatedModules: true
    }
  },
  
  // Reporter configuration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: './test-results/integration',
        outputName: 'integration-results.xml',
        suiteName: 'Integration Tests'
      }
    ]
  ],
  
  // Environment variables for tests
  testEnvironmentOptions: {
    NODE_ENV: 'test'
  }
};