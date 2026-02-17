"use strict";
/**
 * Terminal Injection Connection Adapter
 *
 * Handles terminal injection connections by taking control of a Minecraft
 * server process's stdin/stdout streams. This is used when no other connection
 * methods are available.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TerminalConnectionAdapter = void 0;
const child_process_1 = require("child_process");
const base_1 = require("./base");
const types_1 = require("../../types");
// ============================================================================
// Terminal Injection Adapter
// ============================================================================
class TerminalConnectionAdapter extends base_1.BaseConnectionAdapter {
    constructor(serverId) {
        super(serverId, 'terminal');
        this.outputBuffer = [];
        this.commandQueue = [];
        this.isProcessingCommand = false;
        this.lastOutputTime = 0;
        this.capabilities = [
            'command_execution',
            'console_access',
            'process_control',
            'log_monitoring'
        ];
    }
    // ============================================================================
    // Connection Implementation
    // ============================================================================
    async doConnect(config) {
        const terminalConfig = config.terminal;
        if (!terminalConfig) {
            throw new types_1.ConnectionError('Terminal configuration is required', this.serverId);
        }
        return new Promise((resolve, reject) => {
            try {
                // Try to attach to existing process first
                if (terminalConfig.processId) {
                    this.attachToProcess(terminalConfig.processId)
                        .then(resolve)
                        .catch(() => {
                        // If attach fails, try to spawn new process
                        this.spawnProcess(terminalConfig)
                            .then(resolve)
                            .catch(reject);
                    });
                }
                else {
                    // Spawn new process
                    this.spawnProcess(terminalConfig)
                        .then(resolve)
                        .catch(reject);
                }
            }
            catch (error) {
                reject(error);
            }
        });
    }
    async doDisconnect() {
        this.rejectPendingCommands(new types_1.ConnectionError('Terminal connection closed', this.serverId));
        if (this.process) {
            // Try graceful shutdown first
            try {
                await this.doSendCommand('stop');
                // Wait for process to exit gracefully
                await new Promise((resolve) => {
                    const timeout = setTimeout(() => {
                        if (this.process && !this.process.killed) {
                            this.process.kill('SIGTERM');
                        }
                        resolve();
                    }, 10000); // 10 second grace period
                    this.process.on('exit', () => {
                        clearTimeout(timeout);
                        resolve();
                    });
                });
            }
            catch (error) {
                // Force kill if graceful shutdown fails
                if (this.process && !this.process.killed) {
                    this.process.kill('SIGKILL');
                }
            }
            this.process = undefined;
        }
    }
    async doSendMessage(message) {
        // Terminal injection only supports command execution
        if (message.op === 'server.command' && message.data?.command) {
            const result = await this.doSendCommand(message.data.command);
            // Emit a synthetic response event
            this.emit('commandResult', {
                requestId: message.id,
                result
            });
            return;
        }
        throw new types_1.ConnectionError('Terminal adapter only supports command execution', this.serverId);
    }
    async doSendCommand(command) {
        if (!this.process || !this.process.stdin) {
            throw new types_1.ConnectionError('Terminal process not available', this.serverId);
        }
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new types_1.ConnectionError(`Terminal command timeout: ${command}`, this.serverId));
            }, 30000); // 30 second timeout
            const commandEntry = {
                command,
                resolve: (result) => {
                    clearTimeout(timeout);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeout);
                    reject(error);
                },
                timeout,
                startTime
            };
            this.commandQueue.push(commandEntry);
            this.processCommandQueue();
        });
    }
    doHealthCheck() {
        return this.process !== undefined && !this.process.killed;
    }
    // ============================================================================
    // Process Management
    // ============================================================================
    async attachToProcess(processId) {
        // Note: Attaching to existing processes is complex and platform-specific
        // This is a simplified implementation that would need platform-specific code
        throw new types_1.ConnectionError('Process attachment not implemented in this version', this.serverId);
    }
    async spawnProcess(config) {
        return new Promise((resolve, reject) => {
            try {
                this.process = (0, child_process_1.spawn)(config.command, config.args || [], {
                    cwd: config.workingDir,
                    stdio: ['pipe', 'pipe', 'pipe']
                });
                this.process.on('spawn', () => {
                    this.setupProcessHandlers();
                    resolve();
                });
                this.process.on('error', (error) => {
                    reject(new types_1.ConnectionError(`Failed to spawn process: ${error.message}`, this.serverId));
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    setupProcessHandlers() {
        if (!this.process)
            return;
        // Handle stdout
        this.process.stdout?.on('data', (data) => {
            this.handleOutput(data.toString());
        });
        // Handle stderr
        this.process.stderr?.on('data', (data) => {
            this.handleOutput(data.toString(), true);
        });
        // Handle process exit
        this.process.on('exit', (code, signal) => {
            this.handleProcessExit(code, signal);
        });
        // Handle process errors
        this.process.on('error', (error) => {
            this.emit('error', new types_1.ConnectionError(`Process error: ${error.message}`, this.serverId));
        });
    }
    // ============================================================================
    // Output Processing
    // ============================================================================
    handleOutput(data, isError = false) {
        const lines = data.split('\n').filter(line => line.trim());
        for (const line of lines) {
            this.outputBuffer.push(line);
            this.lastOutputTime = Date.now();
            // Emit log event
            this.emit('logLine', {
                line,
                isError,
                timestamp: new Date()
            });
            // Parse for server events
            this.parseServerEvents(line);
        }
        this.recordMessage();
        // Process command queue if we have pending commands
        if (this.commandQueue.length > 0) {
            this.processCommandQueue();
        }
    }
    parseServerEvents(line) {
        // Parse common Minecraft server log patterns
        const patterns = [
            // Player join
            {
                regex: /\[.*\] \[.*\]: (.*) joined the game/,
                type: 'player.join',
                extract: (match) => ({ playerName: match[1] })
            },
            // Player leave
            {
                regex: /\[.*\] \[.*\]: (.*) left the game/,
                type: 'player.leave',
                extract: (match) => ({ playerName: match[1] })
            },
            // Player chat
            {
                regex: /\[.*\] \[.*\]: <(.*)> (.*)/,
                type: 'player.chat',
                extract: (match) => ({
                    playerName: match[1],
                    message: match[2]
                })
            },
            // Server started
            {
                regex: /\[.*\] \[.*\]: Done \((.*)\)! For help, type "help"/,
                type: 'server.started',
                extract: (match) => ({ startupTime: match[1] })
            },
            // Server stopping
            {
                regex: /\[.*\] \[.*\]: Stopping server/,
                type: 'server.stopping',
                extract: () => ({})
            }
        ];
        for (const pattern of patterns) {
            const match = line.match(pattern.regex);
            if (match) {
                this.emit('serverEvent', {
                    type: pattern.type,
                    data: pattern.extract(match),
                    rawLine: line,
                    timestamp: new Date()
                });
                break;
            }
        }
    }
    processCommandQueue() {
        if (this.isProcessingCommand || this.commandQueue.length === 0) {
            return;
        }
        // Wait for output to settle before processing next command
        const timeSinceLastOutput = Date.now() - this.lastOutputTime;
        if (timeSinceLastOutput < 1000) { // Wait 1 second after last output
            setTimeout(() => this.processCommandQueue(), 1000 - timeSinceLastOutput);
            return;
        }
        this.isProcessingCommand = true;
        const commandEntry = this.commandQueue.shift();
        // Clear output buffer
        this.outputBuffer = [];
        // Send command
        try {
            this.process.stdin.write(commandEntry.command + '\n');
            // Wait for command output
            setTimeout(() => {
                const output = [...this.outputBuffer];
                const executionTime = Date.now() - commandEntry.startTime;
                const result = {
                    success: true,
                    output,
                    executionTime
                };
                commandEntry.resolve(result);
                this.isProcessingCommand = false;
                // Process next command
                if (this.commandQueue.length > 0) {
                    setTimeout(() => this.processCommandQueue(), 100);
                }
            }, 2000); // Wait 2 seconds for output
        }
        catch (error) {
            commandEntry.reject(new types_1.ConnectionError(`Failed to send command: ${error instanceof Error ? error.message : String(error)}`, this.serverId));
            this.isProcessingCommand = false;
        }
    }
    handleProcessExit(code, signal) {
        this.rejectPendingCommands(new types_1.ConnectionError(`Process exited with code ${code}, signal ${signal}`, this.serverId));
        this.emit('processExit', { code, signal });
        this.emit('disconnected');
    }
    rejectPendingCommands(error) {
        for (const command of this.commandQueue) {
            clearTimeout(command.timeout);
            command.reject(error);
        }
        this.commandQueue = [];
        this.isProcessingCommand = false;
    }
    // ============================================================================
    // Terminal-Specific Methods
    // ============================================================================
    /**
     * Get recent log lines
     */
    getRecentLogs(count = 50) {
        return this.outputBuffer.slice(-count);
    }
    /**
     * Send raw input to process
     */
    async sendRawInput(input) {
        if (!this.process || !this.process.stdin) {
            throw new types_1.ConnectionError('Process not available for raw input', this.serverId);
        }
        this.process.stdin.write(input);
    }
    /**
     * Get process information
     */
    getProcessInfo() {
        if (!this.process) {
            return null;
        }
        return {
            pid: this.process.pid,
            killed: this.process.killed,
            exitCode: this.process.exitCode,
            signalCode: this.process.signalCode,
            connected: this.process.connected
        };
    }
}
exports.TerminalConnectionAdapter = TerminalConnectionAdapter;
