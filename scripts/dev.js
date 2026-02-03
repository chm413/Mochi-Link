#!/usr/bin/env node

/**
 * Development Helper Script
 * 
 * This script provides development utilities for the Mochi-Link plugin.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const commands = {
  build: () => {
    console.log('🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    console.log('✅ Build completed');
  },

  test: () => {
    console.log('🧪 Running tests...');
    execSync('npm test', { stdio: 'inherit' });
  },

  'test:watch': () => {
    console.log('👀 Running tests in watch mode...');
    execSync('npm run test:watch', { stdio: 'inherit' });
  },

  lint: () => {
    console.log('🔍 Linting code...');
    execSync('npm run lint', { stdio: 'inherit' });
  },

  'lint:fix': () => {
    console.log('🔧 Fixing lint issues...');
    execSync('npm run lint:fix', { stdio: 'inherit' });
  },

  clean: () => {
    console.log('🧹 Cleaning build artifacts...');
    execSync('npm run clean', { stdio: 'inherit' });
    console.log('✅ Clean completed');
  },

  setup: () => {
    console.log('⚙️ Setting up development environment...');
    
    // Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });
    
    // Build project
    console.log('🔨 Building project...');
    execSync('npm run build', { stdio: 'inherit' });
    
    console.log('✅ Development environment setup completed');
  },

  check: () => {
    console.log('🔍 Running full project check...');
    
    try {
      // Lint
      console.log('1. Linting...');
      execSync('npm run lint', { stdio: 'inherit' });
      
      // Build
      console.log('2. Building...');
      execSync('npm run build', { stdio: 'inherit' });
      
      // Test
      console.log('3. Testing...');
      execSync('npm test', { stdio: 'inherit' });
      
      console.log('✅ All checks passed!');
    } catch (error) {
      console.error('❌ Check failed');
      process.exit(1);
    }
  },

  help: () => {
    console.log(`
🎮 Mochi-Link Development Helper

Available commands:
  setup       - Set up development environment
  build       - Build the project
  test        - Run tests
  test:watch  - Run tests in watch mode
  lint        - Lint code
  lint:fix    - Fix lint issues
  clean       - Clean build artifacts
  check       - Run full project check (lint + build + test)
  help        - Show this help message

Usage:
  node scripts/dev.js <command>
  npm run dev <command>
`);
  }
};

const command = process.argv[2];

if (!command || !commands[command]) {
  console.error('❌ Invalid or missing command');
  commands.help();
  process.exit(1);
}

try {
  commands[command]();
} catch (error) {
  console.error('❌ Command failed:', error.message);
  process.exit(1);
}