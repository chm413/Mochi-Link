#!/usr/bin/env node

/**
 * Integration Test Runner
 * 
 * Orchestrates the execution of all integration tests with proper setup,
 * cleanup, and reporting.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  timeout: 300000, // 5 minutes per test suite
  maxWorkers: 1,   // Run integration tests sequentially to avoid port conflicts
  verbose: true,
  detectOpenHandles: true,
  forceExit: true
};

// Integration test suites
const INTEGRATION_SUITES = [
  {
    name: 'End-to-End Integration',
    file: 'tests/integration/end-to-end.test.ts',
    description: 'Complete system functionality from user requests to responses'
  },
  {
    name: 'Multi-Server Scenarios',
    file: 'tests/integration/multi-server-scenarios.test.ts',
    description: 'Complex scenarios involving multiple servers and cross-server operations'
  },
  {
    name: 'Performance and Load Testing',
    file: 'tests/integration/performance-load.test.ts',
    description: 'System performance under various load conditions and stress testing'
  },
  {
    name: 'Fault Tolerance and Recovery',
    file: 'tests/integration/fault-tolerance.test.ts',
    description: 'System behavior under failure conditions and recovery mechanisms'
  },
  {
    name: 'Comprehensive Test Suite',
    file: 'tests/integration/comprehensive-suite.test.ts',
    description: 'Master test suite with overall system validation'
  }
];

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function log(message, color = 'reset') {
  console.log(colorize(message, color));
}

function logHeader(message) {
  const border = '='.repeat(message.length + 4);
  log(border, 'cyan');
  log(`  ${message}  `, 'cyan');
  log(border, 'cyan');
}

function logSection(message) {
  log(`\n${'-'.repeat(50)}`, 'blue');
  log(message, 'blue');
  log('-'.repeat(50), 'blue');
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: true,
      ...options
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      if (options.verbose) {
        process.stdout.write(data);
      }
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
      if (options.verbose) {
        process.stderr.write(data);
      }
    });

    child.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr
      });
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

async function checkPrerequisites() {
  logSection('Checking Prerequisites');
  
  // Check if Jest is available
  try {
    const result = await runCommand('npx', ['jest', '--version'], { verbose: false });
    if (result.code === 0) {
      log(`✓ Jest is available: ${result.stdout.trim()}`, 'green');
    } else {
      throw new Error('Jest not found');
    }
  } catch (error) {
    log('✗ Jest is not available. Please install dependencies first.', 'red');
    log('  Run: npm install', 'yellow');
    process.exit(1);
  }

  // Check if TypeScript is available
  try {
    const result = await runCommand('npx', ['tsc', '--version'], { verbose: false });
    if (result.code === 0) {
      log(`✓ TypeScript is available: ${result.stdout.trim()}`, 'green');
    } else {
      throw new Error('TypeScript not found');
    }
  } catch (error) {
    log('✗ TypeScript is not available. Please install dependencies first.', 'red');
    log('  Run: npm install', 'yellow');
    process.exit(1);
  }

  // Check if test files exist
  let missingFiles = 0;
  for (const suite of INTEGRATION_SUITES) {
    if (!fs.existsSync(suite.file)) {
      log(`✗ Missing test file: ${suite.file}`, 'red');
      missingFiles++;
    } else {
      log(`✓ Found test file: ${suite.file}`, 'green');
    }
  }

  if (missingFiles > 0) {
    log(`\n✗ ${missingFiles} test files are missing. Cannot proceed.`, 'red');
    process.exit(1);
  }

  log('\n✓ All prerequisites met', 'green');
}

async function runIntegrationSuite(suite, index, total) {
  logSection(`Running Suite ${index + 1}/${total}: ${suite.name}`);
  log(`Description: ${suite.description}`, 'cyan');
  log(`File: ${suite.file}`, 'cyan');
  
  const startTime = Date.now();
  
  try {
    const jestArgs = [
      'jest',
      suite.file,
      '--testTimeout', TEST_CONFIG.timeout.toString(),
      '--maxWorkers', TEST_CONFIG.maxWorkers.toString(),
      '--detectOpenHandles',
      '--forceExit',
      '--verbose'
    ];

    log(`\nExecuting: npx ${jestArgs.join(' ')}`, 'yellow');
    
    const result = await runCommand('npx', jestArgs, { 
      verbose: TEST_CONFIG.verbose,
      timeout: TEST_CONFIG.timeout + 30000 // Add 30 seconds buffer
    });

    const duration = Date.now() - startTime;
    const durationStr = `${(duration / 1000).toFixed(2)}s`;

    if (result.code === 0) {
      log(`\n✓ ${suite.name} completed successfully in ${durationStr}`, 'green');
      return { success: true, duration, output: result.stdout };
    } else {
      log(`\n✗ ${suite.name} failed after ${durationStr}`, 'red');
      log('Error output:', 'red');
      log(result.stderr, 'red');
      return { success: false, duration, output: result.stderr, error: result.stderr };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const durationStr = `${(duration / 1000).toFixed(2)}s`;
    
    log(`\n✗ ${suite.name} failed with error after ${durationStr}`, 'red');
    log(`Error: ${error.message}`, 'red');
    return { success: false, duration, output: '', error: error.message };
  }
}

async function generateReport(results) {
  logSection('Integration Test Report');
  
  const totalSuites = results.length;
  const passedSuites = results.filter(r => r.success).length;
  const failedSuites = totalSuites - passedSuites;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  
  log(`Total Suites: ${totalSuites}`, 'cyan');
  log(`Passed: ${passedSuites}`, passedSuites > 0 ? 'green' : 'yellow');
  log(`Failed: ${failedSuites}`, failedSuites > 0 ? 'red' : 'green');
  log(`Total Duration: ${(totalDuration / 1000).toFixed(2)}s`, 'cyan');
  log(`Success Rate: ${((passedSuites / totalSuites) * 100).toFixed(1)}%`, 
      passedSuites === totalSuites ? 'green' : 'yellow');

  log('\nDetailed Results:', 'bright');
  results.forEach((result, index) => {
    const suite = INTEGRATION_SUITES[index];
    const status = result.success ? '✓ PASS' : '✗ FAIL';
    const color = result.success ? 'green' : 'red';
    const duration = `${(result.duration / 1000).toFixed(2)}s`;
    
    log(`  ${status} ${suite.name} (${duration})`, color);
    
    if (!result.success && result.error) {
      log(`    Error: ${result.error.split('\n')[0]}`, 'red');
    }
  });

  // Generate JSON report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSuites,
      passedSuites,
      failedSuites,
      successRate: (passedSuites / totalSuites) * 100,
      totalDuration: totalDuration / 1000
    },
    suites: results.map((result, index) => ({
      name: INTEGRATION_SUITES[index].name,
      file: INTEGRATION_SUITES[index].file,
      description: INTEGRATION_SUITES[index].description,
      success: result.success,
      duration: result.duration / 1000,
      error: result.error || null
    }))
  };

  // Save report to file
  const reportPath = path.join(process.cwd(), 'integration-test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  log(`\nDetailed report saved to: ${reportPath}`, 'cyan');

  return report;
}

async function main() {
  logHeader('Mochi-Link Integration Test Suite');
  
  const startTime = Date.now();
  
  try {
    // Check prerequisites
    await checkPrerequisites();
    
    // Run integration test suites
    log('\nStarting integration test execution...', 'bright');
    const results = [];
    
    for (let i = 0; i < INTEGRATION_SUITES.length; i++) {
      const suite = INTEGRATION_SUITES[i];
      const result = await runIntegrationSuite(suite, i, INTEGRATION_SUITES.length);
      results.push(result);
      
      // Add delay between suites to allow cleanup
      if (i < INTEGRATION_SUITES.length - 1) {
        log('\nWaiting for cleanup...', 'yellow');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Generate report
    const report = await generateReport(results);
    
    const totalDuration = Date.now() - startTime;
    log(`\nIntegration testing completed in ${(totalDuration / 1000).toFixed(2)}s`, 'bright');
    
    // Exit with appropriate code
    const allPassed = results.every(r => r.success);
    if (allPassed) {
      log('\n🎉 All integration tests passed!', 'green');
      process.exit(0);
    } else {
      log('\n❌ Some integration tests failed. Check the report for details.', 'red');
      process.exit(1);
    }
    
  } catch (error) {
    log(`\nFatal error during integration testing: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  log('\n\nReceived SIGINT. Cleaning up...', 'yellow');
  process.exit(130);
});

process.on('SIGTERM', () => {
  log('\n\nReceived SIGTERM. Cleaning up...', 'yellow');
  process.exit(143);
});

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = {
  runIntegrationSuite,
  generateReport,
  INTEGRATION_SUITES,
  TEST_CONFIG
};