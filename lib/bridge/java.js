"use strict";
/**
 * Java Edition Connector Bridge
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JavaConnectorBridge = void 0;
class JavaConnectorBridge {
    constructor(config, connectionAdapter) {
        this.connected = false;
        this.config = config;
        this.connectionAdapter = connectionAdapter;
    }
    async connect() {
        if (this.connectionAdapter && !this.connectionAdapter.isConnected) {
            await this.connectionAdapter.connect();
        }
        this.connected = true;
    }
    async disconnect() {
        if (this.connectionAdapter && this.connectionAdapter.isConnected) {
            await this.connectionAdapter.disconnect();
        }
        this.connected = false;
    }
    async isHealthy() {
        if (!this.connected) {
            return false;
        }
        // 已连接时主动探测一次（避免"连接假活"）
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                const result = await this.executeCommand('list');
                return !!(result && result.success);
            }
            catch {
                return false;
            }
        }
        return false;
    }
    isConnectedToBridge() {
        return this.connected;
    }
    /**
     * 解析 "list" 命令输出：
     * "There are 5 of a max of 20 players online: player1, player2"
     */
    parseListOutput(output) {
        const text = (output || []).join(' ');
        const match = text.match(/There are (\d+) of a max of (\d+) players online/);
        if (!match) {
            return { online: 0, max: 0, names: [] };
        }
        const namesPart = text.split('online:')[1] || '';
        const names = namesPart
            .split(',')
            .map(n => n.trim())
            .filter(n => n.length > 0);
        return { online: parseInt(match[1], 10), max: parseInt(match[2], 10), names };
    }
    async getServerInfo() {
        let version = this.config?.coreVersion || '1.20.1';
        let online = 0;
        let max = 0;
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                const versionResult = await this.connectionAdapter.sendCommand('version');
                if (versionResult && versionResult.success && versionResult.output) {
                    const versionMatch = (versionResult.output.join(' ') || '').match(/version ([^\s]+)/i);
                    if (versionMatch) {
                        version = versionMatch[1];
                    }
                }
                const listResult = await this.connectionAdapter.sendCommand('list');
                if (listResult && listResult.success && listResult.output) {
                    const parsed = this.parseListOutput(listResult.output);
                    online = parsed.online;
                    max = parsed.max;
                }
            }
            catch {
                // 查询失败时保留默认值，不阻塞基本信息返回
            }
        }
        return {
            serverId: this.config?.serverId || 'test',
            name: this.config?.name || 'Test Server',
            version,
            coreType: 'Java',
            coreName: this.config?.coreName || 'Paper',
            maxPlayers: max,
            onlinePlayers: online,
            uptime: 0,
            tps: 20.0,
            memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
            worldInfo: []
        };
    }
    async getPerformanceMetrics() {
        let tps = 20.0;
        let memoryUsed = 0;
        let memoryMax = 0;
        let playerCount = 0;
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                const tpsResult = await this.connectionAdapter.sendCommand('tps');
                if (tpsResult && tpsResult.success && tpsResult.output) {
                    const match = tpsResult.output.join(' ').match(/([\d.]+),?\s*([\d.]+)?,?\s*([\d.]+)?\s*$/);
                    if (match) {
                        tps = parseFloat(match[1]);
                    }
                }
                const memResult = await this.connectionAdapter.sendCommand('memory');
                if (memResult && memResult.success && memResult.output) {
                    const match = memResult.output.join(' ').match(/(\d+)MB\s*\/\s*(\d+)MB/);
                    if (match) {
                        memoryUsed = parseInt(match[1], 10);
                        memoryMax = parseInt(match[2], 10);
                    }
                }
                const listResult = await this.connectionAdapter.sendCommand('list');
                if (listResult && listResult.success && listResult.output) {
                    playerCount = this.parseListOutput(listResult.output).online;
                }
            }
            catch {
                // 查询失败时使用默认值
            }
        }
        const memoryPercentage = memoryMax > 0 ? (memoryUsed / memoryMax) * 100 : 0;
        return {
            serverId: this.config?.serverId || 'test',
            timestamp: Date.now(),
            tps,
            cpuUsage: 0,
            memoryUsage: { used: memoryUsed, max: memoryMax, free: Math.max(0, memoryMax - memoryUsed), percentage: memoryPercentage },
            playerCount,
            ping: 0
        };
    }
    async executeCommand(command, timeout) {
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                return await this.connectionAdapter.sendCommand(command, timeout);
            }
            catch (error) {
                // 命令失败（含超时）以结构化结果返回，不向调用方抛异常
                return {
                    success: false,
                    error: error instanceof Error ? error.message : String(error),
                    output: [],
                    executionTime: 0
                };
            }
        }
        return {
            success: false,
            output: [],
            error: 'No active Java connector adapter is available',
            executionTime: 0
        };
    }
    async doExecuteCommand(command, timeout) {
        return await this.executeCommand(command, timeout);
    }
    async getOnlinePlayers() {
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                const result = await this.executeCommand('list');
                if (result && result.success && result.output) {
                    return this.parseListOutput(result.output).names.map(name => ({
                        name,
                        edition: 'Java'
                    }));
                }
            }
            catch {
                return [];
            }
        }
        return [];
    }
    async getPlayerDetail(playerId) {
        if (!this.connectionAdapter || !this.connectionAdapter.sendCommand) {
            return null;
        }
        try {
            // 通过 WebSocket 发送 player.info 请求
            const requestId = `player-info-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            // 创建响应 Promise
            const responsePromise = new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Player info request timeout'));
                }, 10000);
                // 临时存储 pending request（需要在 connectionAdapter 中处理）
                if (this.connectionAdapter.pendingRequests) {
                    this.connectionAdapter.pendingRequests.set(requestId, {
                        resolve,
                        reject,
                        timeout
                    });
                }
                else {
                    clearTimeout(timeout);
                    reject(new Error('Connection adapter does not support request-response pattern'));
                }
            });
            // 发送请求
            await this.connectionAdapter.send({
                type: 'request',
                id: requestId,
                op: 'player.info',
                data: {
                    playerId: playerId
                },
                timestamp: Date.now(),
                serverId: this.config.serverId,
                version: '2.0'
            });
            // 等待响应
            const response = await responsePromise;
            // 返回玩家详细信息（包含 health, level, gameMode, isOnline 等字段）
            return response.data?.player || response.data?.playerInfo || null;
        }
        catch (error) {
            console.error(`Failed to get player detail for ${playerId}:`, error);
            return null;
        }
    }
    getCapabilities() {
        return [
            'player_management',
            'world_management',
            'command_execution',
            'performance_monitoring',
            'event_streaming',
            'whitelist_management',
            'ban_management',
            'operator_management',
            'server_control',
            'plugin_integration'
        ];
    }
    getBridgeInfo() {
        return {
            serverId: this.config?.serverId || 'test',
            coreType: 'Java',
            coreName: this.config?.coreName || 'Paper',
            coreVersion: this.config?.coreVersion || '1.20.1',
            capabilities: this.getCapabilities(),
            protocolVersion: '2.0',
            isOnline: this.connected,
            lastUpdate: new Date()
        };
    }
    async performPlayerAction(action) {
        const command = this.buildPlayerActionCommand(action);
        if (command) {
            const result = await this.executeCommand(command);
            return {
                success: !!(result && result.success),
                action,
                timestamp: new Date(),
                affectedPlayer: action?.target || null,
                output: result?.output || []
            };
        }
        return {
            success: false,
            action,
            timestamp: new Date(),
            affectedPlayer: action?.target || null,
            error: `Unsupported player action type: ${action?.type}`
        };
    }
    buildPlayerActionCommand(action) {
        if (!action || !action.type) {
            return null;
        }
        switch (action.type) {
            case 'kick':
                return action.reason
                    ? `kick ${action.target} ${action.reason}`
                    : `kick ${action.target}`;
            case 'ban':
                return action.reason
                    ? `ban ${action.target} ${action.reason}`
                    : `ban ${action.target}`;
            case 'teleport': {
                const pos = action.metadata || {};
                if (pos.x === undefined || pos.y === undefined || pos.z === undefined) {
                    return null;
                }
                return `tp ${action.target} ${pos.x} ${pos.y} ${pos.z}`;
            }
            case 'kill':
                return `kill ${action.target}`;
            case 'op':
                return `op ${action.target}`;
            case 'deop':
                return `deop ${action.target}`;
            default:
                return null;
        }
    }
    async performWorldOperation(operation) {
        const command = this.buildWorldOperationCommand(operation);
        if (command) {
            const result = await this.executeCommand(command);
            return {
                success: !!(result && result.success),
                operation,
                timestamp: new Date(),
                duration: result?.executionTime || 0,
                output: result?.output || []
            };
        }
        return {
            success: false,
            operation,
            timestamp: new Date(),
            duration: 0,
            error: `Unsupported world operation type: ${operation?.type}`
        };
    }
    buildWorldOperationCommand(operation) {
        if (!operation || !operation.type) {
            return null;
        }
        switch (operation.type) {
            case 'save':
                return 'save-all';
            case 'saveOn':
                return 'save-on';
            case 'saveOff':
                return 'save-off';
            case 'reload':
                return 'reload';
            case 'stop':
                return 'stop';
            default:
                return null;
        }
    }
    async updateWorldSettings(settings) {
        if (!settings) {
            return false;
        }
        let allSuccess = true;
        if (settings.time !== undefined) {
            const result = await this.executeCommand(`time set ${settings.time}`);
            allSuccess = allSuccess && !!(result && result.success);
        }
        if (settings.weather !== undefined) {
            const result = await this.executeCommand(`weather ${settings.weather}`);
            allSuccess = allSuccess && !!(result && result.success);
        }
        if (settings.difficulty !== undefined) {
            const result = await this.executeCommand(`difficulty ${settings.difficulty}`);
            allSuccess = allSuccess && !!(result && result.success);
        }
        return allSuccess;
    }
}
exports.JavaConnectorBridge = JavaConnectorBridge;
