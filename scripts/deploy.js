#!/usr/bin/env node

/**
 * Mochi-Link Deployment Script
 * 
 * This script handles deployment configuration, environment setup,
 * and system validation for the Mochi-Link system.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================================
// Configuration
// ============================================================================

const ENVIRONMENTS = ['development', 'staging', 'production'];
const CONFIG_DIR = path.join(__dirname, '..', 'config');
const DEPLOYMENT_CONFIG_FILE = path.join(CONFIG_DIR, 'deployment.json');

// ============================================================================
// Utility Functions
// ============================================================================

function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

function error(message) {
  log(message, 'error');
  process.exit(1);
}

function ensureDirectory(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    log(`Created directory: ${dir}`);
  }
}

function loadPackageJson() {
  const packagePath = path.join(__dirname, '..', 'package.json');
  if (!fs.existsSync(packagePath)) {
    error('package.json not found');
  }
  return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
}

function detectEnvironment() {
  // Check NODE_ENV first
  const nodeEnv = process.env.NODE_ENV?.toLowerCase();
  if (ENVIRONMENTS.includes(nodeEnv)) return nodeEnv;

  // Check MOCHI_ENV
  const mochiEnv = process.env.MOCHI_ENV?.toLowerCase();
  if (ENVIRONMENTS.includes(mochiEnv)) return mochiEnv;

  // Check for production indicators
  if (process.env.PM2_HOME || process.env.DOCKER_CONTAINER) {
    return 'production';
  }

  // Default to development
  return 'development';
}

// ============================================================================
// Configuration Generation
// ============================================================================

function generateDefaultConfig(environment) {
  const pkg = loadPackageJson();
  const isProduction = environment === 'production';
  const isStaging = environment === 'staging';
  
  return {
    environment,
    version: pkg.version,
    buildTime: new Date().toISOString(),
    
    services: {
      websocket: {
        enabled: true,
        port: parseInt(process.env.MOCHI_WS_PORT) || (isProduction ? 8080 : 8080),
        host: isProduction || isStaging ? '0.0.0.0' : '127.0.0.1',
        ssl: {
          enabled: isProduction || isStaging,
          certPath: '/etc/ssl/certs/mochi-link.crt',
          keyPath: '/etc/ssl/private/mochi-link.key'
        }
      },
      http: {
        enabled: true,
        port: parseInt(process.env.MOCHI_HTTP_PORT) || (isProduction ? 8081 : 8081),
        host: isProduction || isStaging ? '0.0.0.0' : '127.0.0.1',
        cors: !isProduction
      },
      database: {
        prefix: process.env.MOCHI_DB_PREFIX || (environment === 'development' ? 'mochi_dev_' : 'mochi_'),
        connectionTimeout: isProduction ? 30000 : 10000,
        queryTimeout: isProduction ? 15000 : 5000
      }
    },
    
    security: {
      tokenExpiry: parseInt(process.env.MOCHI_TOKEN_EXPIRY) || (environment === 'development' ? 3600 : 86400),
      maxConnections: parseInt(process.env.MOCHI_MAX_CONNECTIONS) || (isProduction ? 500 : 50),
      rateLimiting: {
        enabled: isProduction || isStaging,
        windowMs: 60000,
        maxRequests: isProduction ? 100 : 1000
      },
      encryption: {
        enabled: isProduction || isStaging,
        algorithm: 'AES-256-GCM'
      }
    },
    
    monitoring: {
      enabled: true,
      reportInterval: 30,
      historyRetention: isProduction ? 90 : 7,
      healthCheck: {
        interval: 30000,
        timeout: 5000
      },
      metrics: {
        enabled: true,
        interval: 60000,
        retention: isProduction ? 90 : 7
      }
    },
    
    logging: {
      level: process.env.MOCHI_LOG_LEVEL || (environment === 'development' ? 'debug' : isProduction ? 'warn' : 'info'),
      auditRetention: isProduction ? 365 : 30,
      fileLogging: {
        enabled: isProduction || isStaging,
        path: '/var/log/mochi-link',
        maxSize: isProduction ? '500MB' : '100MB',
        maxFiles: isProduction ? 20 : 10
      }
    },
    
    performance: {
      caching: {
        enabled: true,
        maxSize: isProduction ? 1000 : 100,
        ttl: isProduction ? 1800 : 300
      },
      connectionPool: {
        enabled: isProduction || isStaging,
        minConnections: isProduction ? 5 : 1,
        maxConnections: isProduction ? 50 : 5,
        idleTimeout: isProduction ? 300000 : 30000
      },
      optimization: {
        enabled: isProduction || isStaging,
        queryCache: true,
        compression: isProduction || isStaging
      }
    }
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

function validateEnvironmentVariables() {
  const errors = [];
  const environment = detectEnvironment();
  
  // Check required environment variables for production
  if (environment === 'production') {
    const required = [
      'MOCHI_WS_PORT',
      'MOCHI_HTTP_PORT',
      'MOCHI_DB_PREFIX'
    ];

    for (const envVar of required) {
      if (!process.env[envVar]) {
        errors.push(`Required environment variable ${envVar} is not set`);
      }
    }
  }

  // Validate port numbers
  const portVars = ['MOCHI_WS_PORT', 'MOCHI_HTTP_PORT'];
  for (const portVar of portVars) {
    if (process.env[portVar]) {
      const port = parseInt(process.env[portVar]);
      if (isNaN(port) || port < 1 || port > 65535) {
        errors.push(`${portVar} must be a valid port number (1-65535)`);
      }
    }
  }

  // Validate log level
  if (process.env.MOCHI_LOG_LEVEL) {
    const validLevels = ['debug', 'info', 'warn', 'error'];
    if (!validLevels.includes(process.env.MOCHI_LOG_LEVEL)) {
      errors.push(`MOCHI_LOG_LEVEL must be one of: ${validLevels.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateConfiguration(config) {
  const errors = [];

  // Validate ports
  if (config.services.websocket.port < 1 || config.services.websocket.port > 65535) {
    errors.push('WebSocket port must be between 1 and 65535');
  }

  if (config.services.http.enabled && 
      (config.services.http.port < 1 || config.services.http.port > 65535)) {
    errors.push('HTTP port must be between 1 and 65535');
  }

  // Validate SSL configuration
  if (config.services.websocket.ssl?.enabled) {
    if (!config.services.websocket.ssl.certPath) {
      errors.push('SSL certificate path is required when SSL is enabled');
    }
    if (!config.services.websocket.ssl.keyPath) {
      errors.push('SSL private key path is required when SSL is enabled');
    }
  }

  // Validate security settings
  if (config.security.tokenExpiry < 60) {
    errors.push('Token expiry must be at least 60 seconds');
  }

  if (config.security.maxConnections < 1) {
    errors.push('Maximum connections must be at least 1');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// System Checks
// ============================================================================

function checkSystemRequirements() {
  log('Checking system requirements...');
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 16) {
    error(`Node.js version ${nodeVersion} is not supported. Please use Node.js 16 or higher.`);
  }
  
  log(`Node.js version: ${nodeVersion} ✓`);
  
  // Check npm/yarn
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    log(`npm version: ${npmVersion} ✓`);
  } catch (err) {
    error('npm is not installed or not accessible');
  }
  
  // Check TypeScript
  try {
    const tscVersion = execSync('npx tsc --version', { encoding: 'utf8' }).trim();
    log(`TypeScript version: ${tscVersion} ✓`);
  } catch (err) {
    log('TypeScript not found, will be installed with dependencies', 'warn');
  }
  
  log('System requirements check completed');
}

function checkDependencies() {
  log('Checking dependencies...');
  
  const packagePath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Check if node_modules exists
  const nodeModulesPath = path.join(__dirname, '..', 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    log('node_modules not found, installing dependencies...', 'warn');
    try {
      execSync('npm install', { stdio: 'inherit', cwd: path.dirname(packagePath) });
      log('Dependencies installed successfully ✓');
    } catch (err) {
      error('Failed to install dependencies');
    }
  } else {
    log('Dependencies found ✓');
  }
}

// ============================================================================
// Build Functions
// ============================================================================

function buildProject() {
  log('Building project...');
  
  try {
    // Clean previous build
    const libPath = path.join(__dirname, '..', 'lib');
    if (fs.existsSync(libPath)) {
      execSync('npm run clean', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    }
    
    // Build TypeScript
    execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    log('Project built successfully ✓');
    
  } catch (err) {
    error('Build failed');
  }
}

function runTests() {
  log('Running tests...');
  
  try {
    execSync('npm test', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    log('All tests passed ✓');
  } catch (err) {
    error('Tests failed');
  }
}

// ============================================================================
// Deployment Functions
// ============================================================================

function generateConfig(environment) {
  log(`Generating configuration for ${environment} environment...`);
  
  ensureDirectory(CONFIG_DIR);
  
  const config = generateDefaultConfig(environment);
  const configJson = JSON.stringify(config, null, 2);
  
  fs.writeFileSync(DEPLOYMENT_CONFIG_FILE, configJson, 'utf8');
  log(`Configuration saved to ${DEPLOYMENT_CONFIG_FILE}`);
  
  return config;
}

function validateDeployment(environment) {
  log(`Validating deployment for ${environment} environment...`);
  
  // Validate environment variables
  const envValidation = validateEnvironmentVariables();
  if (!envValidation.valid) {
    log('Environment variable validation failed:', 'error');
    envValidation.errors.forEach(err => log(`  - ${err}`, 'error'));
    if (environment === 'production') {
      error('Cannot deploy to production with invalid environment variables');
    } else {
      log('Continuing with warnings...', 'warn');
    }
  } else {
    log('Environment variables validated ✓');
  }
  
  // Load and validate configuration
  let config;
  if (fs.existsSync(DEPLOYMENT_CONFIG_FILE)) {
    config = JSON.parse(fs.readFileSync(DEPLOYMENT_CONFIG_FILE, 'utf8'));
  } else {
    config = generateConfig(environment);
  }
  
  const configValidation = validateConfiguration(config);
  if (!configValidation.valid) {
    log('Configuration validation failed:', 'error');
    configValidation.errors.forEach(err => log(`  - ${err}`, 'error'));
    error('Cannot deploy with invalid configuration');
  } else {
    log('Configuration validated ✓');
  }
  
  return config;
}

function createStartupScript(environment, config) {
  log('Creating startup script...');
  
  const scriptsDir = path.join(__dirname);
  const startScript = path.join(scriptsDir, 'start.sh');
  
  const scriptContent = `#!/bin/bash

# Mochi-Link Startup Script
# Environment: ${environment}
# Generated: ${new Date().toISOString()}

set -e

# Set environment variables
export NODE_ENV="${environment}"
export MOCHI_ENV="${environment}"
export MOCHI_WS_PORT="${config.services.websocket.port}"
export MOCHI_HTTP_PORT="${config.services.http.port}"
export MOCHI_DB_PREFIX="${config.services.database.prefix}"
export MOCHI_LOG_LEVEL="${config.logging.level}"

# Create log directory if it doesn't exist
if [ "${config.logging.fileLogging.enabled}" = "true" ]; then
  mkdir -p "${config.logging.fileLogging.path}"
fi

# Start the application
echo "Starting Mochi-Link in ${environment} mode..."
echo "WebSocket server: ${config.services.websocket.host}:${config.services.websocket.port}"
echo "HTTP API server: ${config.services.http.host}:${config.services.http.port}"

# Use PM2 in production, direct node in development
if [ "${environment}" = "production" ]; then
  pm2 start ecosystem.config.js --env production
else
  npm start
fi
`;

  fs.writeFileSync(startScript, scriptContent, 'utf8');
  fs.chmodSync(startScript, '755');
  
  log(`Startup script created: ${startScript}`);
}

function createEcosystemConfig(environment, config) {
  log('Creating PM2 ecosystem configuration...');
  
  const ecosystemPath = path.join(__dirname, '..', 'ecosystem.config.js');
  
  const ecosystemContent = `module.exports = {
  apps: [{
    name: 'mochi-link',
    script: 'lib/index.js',
    instances: ${environment === 'production' ? 'max' : 1},
    exec_mode: ${environment === 'production' ? "'cluster'" : "'fork'"},
    env: {
      NODE_ENV: 'development',
      MOCHI_ENV: 'development'
    },
    env_staging: {
      NODE_ENV: 'staging',
      MOCHI_ENV: 'staging',
      MOCHI_WS_PORT: ${config.services.websocket.port},
      MOCHI_HTTP_PORT: ${config.services.http.port},
      MOCHI_DB_PREFIX: '${config.services.database.prefix}',
      MOCHI_LOG_LEVEL: '${config.logging.level}'
    },
    env_production: {
      NODE_ENV: 'production',
      MOCHI_ENV: 'production',
      MOCHI_WS_PORT: ${config.services.websocket.port},
      MOCHI_HTTP_PORT: ${config.services.http.port},
      MOCHI_DB_PREFIX: '${config.services.database.prefix}',
      MOCHI_LOG_LEVEL: '${config.logging.level}'
    },
    log_file: '${config.logging.fileLogging.enabled ? config.logging.fileLogging.path + '/combined.log' : './logs/combined.log'}',
    out_file: '${config.logging.fileLogging.enabled ? config.logging.fileLogging.path + '/out.log' : './logs/out.log'}',
    error_file: '${config.logging.fileLogging.enabled ? config.logging.fileLogging.path + '/error.log' : './logs/error.log'}',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_memory_restart: '${environment === 'production' ? '1G' : '500M'}',
    node_args: '--max-old-space-size=${environment === 'production' ? '2048' : '1024'}',
    watch: ${environment === 'development'},
    ignore_watch: ['node_modules', 'logs', 'config'],
    restart_delay: ${environment === 'production' ? '5000' : '1000'}
  }]
};
`;

  fs.writeFileSync(ecosystemPath, ecosystemContent, 'utf8');
  log(`PM2 ecosystem configuration created: ${ecosystemPath}`);
}

// ============================================================================
// Main Commands
// ============================================================================

function commandInit(environment) {
  log(`Initializing Mochi-Link for ${environment} environment...`);
  
  checkSystemRequirements();
  checkDependencies();
  
  const config = generateConfig(environment);
  createStartupScript(environment, config);
  createEcosystemConfig(environment, config);
  
  log(`Initialization completed for ${environment} environment ✓`);
  log('Next steps:');
  log('  1. Review the generated configuration in config/deployment.json');
  log('  2. Set up SSL certificates if deploying to staging/production');
  log('  3. Configure your database connection in Koishi');
  log('  4. Run "npm run deploy:build" to build the project');
  log('  5. Run "npm run deploy:start" to start the application');
}

function commandBuild() {
  log('Building Mochi-Link for deployment...');
  
  checkSystemRequirements();
  checkDependencies();
  buildProject();
  runTests();
  
  log('Build completed successfully ✓');
}

function commandValidate(environment) {
  log(`Validating deployment configuration for ${environment}...`);
  
  const config = validateDeployment(environment);
  
  log('Validation completed successfully ✓');
  log('Configuration summary:');
  log(`  Environment: ${config.environment}`);
  log(`  Version: ${config.version}`);
  log(`  WebSocket: ${config.services.websocket.host}:${config.services.websocket.port}`);
  log(`  HTTP API: ${config.services.http.host}:${config.services.http.port}`);
  log(`  SSL Enabled: ${config.services.websocket.ssl.enabled}`);
  log(`  Monitoring: ${config.monitoring.enabled ? 'Enabled' : 'Disabled'}`);
}

function commandStart(environment) {
  log(`Starting Mochi-Link in ${environment} mode...`);
  
  const config = validateDeployment(environment);
  
  // Set environment variables
  process.env.NODE_ENV = environment;
  process.env.MOCHI_ENV = environment;
  
  if (environment === 'production') {
    log('Starting with PM2...');
    try {
      execSync('pm2 start ecosystem.config.js --env production', { stdio: 'inherit' });
      log('Application started successfully with PM2 ✓');
    } catch (err) {
      error('Failed to start with PM2');
    }
  } else {
    log('Starting in development mode...');
    try {
      execSync('npm start', { stdio: 'inherit' });
    } catch (err) {
      error('Failed to start application');
    }
  }
}

function commandStop() {
  log('Stopping Mochi-Link...');
  
  try {
    execSync('pm2 stop mochi-link', { stdio: 'inherit' });
    log('Application stopped successfully ✓');
  } catch (err) {
    log('PM2 stop failed, application may not be running', 'warn');
  }
}

function commandStatus() {
  log('Checking Mochi-Link status...');
  
  try {
    execSync('pm2 status mochi-link', { stdio: 'inherit' });
  } catch (err) {
    log('PM2 status failed, application may not be running', 'warn');
  }
}

function showHelp() {
  console.log(`
Mochi-Link Deployment Script

Usage: node scripts/deploy.js <command> [environment]

Commands:
  init [env]      Initialize deployment configuration (default: auto-detect)
  build           Build the project for deployment
  validate [env]  Validate deployment configuration (default: auto-detect)
  start [env]     Start the application (default: auto-detect)
  stop            Stop the application
  status          Check application status
  help            Show this help message

Environments:
  development     Development environment (default)
  staging         Staging environment
  production      Production environment

Environment Variables:
  NODE_ENV        Node.js environment
  MOCHI_ENV       Mochi-Link environment override
  MOCHI_WS_PORT   WebSocket server port
  MOCHI_HTTP_PORT HTTP API server port
  MOCHI_DB_PREFIX Database table prefix
  MOCHI_LOG_LEVEL Logging level (debug, info, warn, error)

Examples:
  node scripts/deploy.js init production
  node scripts/deploy.js build
  node scripts/deploy.js validate staging
  node scripts/deploy.js start production
  node scripts/deploy.js stop
`);
}

// ============================================================================
// Main Entry Point
// ============================================================================

function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1] || detectEnvironment();
  
  if (!ENVIRONMENTS.includes(environment)) {
    error(`Invalid environment: ${environment}. Must be one of: ${ENVIRONMENTS.join(', ')}`);
  }
  
  switch (command) {
    case 'init':
      commandInit(environment);
      break;
    case 'build':
      commandBuild();
      break;
    case 'validate':
      commandValidate(environment);
      break;
    case 'start':
      commandStart(environment);
      break;
    case 'stop':
      commandStop();
      break;
    case 'status':
      commandStatus();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      log(`Unknown command: ${command}`, 'error');
      showHelp();
      process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  generateDefaultConfig,
  validateEnvironmentVariables,
  validateConfiguration,
  detectEnvironment
};