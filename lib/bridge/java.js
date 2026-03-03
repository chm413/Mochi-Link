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
        return this.connected;
    }
    isConnectedToBridge() {
        return this.connected;
    }
    async getServerInfo() {
        return {
            serverId: this.config?.serverId || 'test',
            name: 'Test Server',
            version: '1.20.1',
            coreType: 'Java',
            coreName: 'Paper',
            maxPlayers: 20,
            onlinePlayers: 0,
            uptime: 0,
            tps: 20.0,
            memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
            worldInfo: []
        };
    }
    async getPerformanceMetrics() {
        return {
            serverId: this.config?.serverId || 'test',
            timestamp: Date.now(),
            tps: 20.0,
            cpuUsage: 0,
            memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
            playerCount: 0,
            ping: 0
        };
    }
    async executeCommand(command, timeout) {
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            return await this.connectionAdapter.sendCommand(command, timeout);
        }
        return {
            success: true,
            output: [`Executed: ${command}`],
            executionTime: 100
        };
    }
    async doExecuteCommand(command, timeout) {
        return await this.executeCommand(command, timeout);
    }
    async getOnlinePlayers() {
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
        return {
            success: true,
            action,
            timestamp: new Date(),
            affectedPlayer: null
        };
    }
    async performWorldOperation(operation) {
        return {
            success: true,
            operation,
            timestamp: new Date(),
            duration: 100
        };
    }
    async updateWorldSettings(settings) {
        return true;
    }
}
exports.JavaConnectorBridge = JavaConnectorBridge;
