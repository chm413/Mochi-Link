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
        const match = text.match(/There are\s+(\d+)\s+of\s+(?:a\s+max\s+of\s+)?(\d+)\s+players online/i);
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
    /** Send a canonical U-WBP request when the adapter supports it. */
    async sendProtocolRequest(op, data = {}, timeout = 10000) {
        if (!this.connectionAdapter || typeof this.connectionAdapter.sendRequest !== 'function') {
            return null;
        }
        return this.connectionAdapter.sendRequest(op, data, timeout);
    }
    responseData(response) {
        const data = response?.data && typeof response.data === 'object' ? response.data : {};
        return data.result && typeof data.result === 'object' ? data.result : data;
    }
    normalizeMemory(value) {
        const memory = value && typeof value === 'object' ? value : {};
        const used = Number(memory.used ?? 0);
        const max = Number(memory.max ?? 0);
        const free = Number(memory.free ?? Math.max(0, max - used));
        const percentage = Number(memory.percentage ?? (max > 0 ? used / max * 100 : 0));
        return { used, max, free, percentage };
    }
    normalizePlayer(value) {
        if (!value || typeof value !== 'object' || !value.id || !value.name)
            return null;
        return {
            id: String(value.id),
            name: String(value.name),
            displayName: String(value.displayName ?? value.name),
            world: String(value.world ?? 'unknown'),
            position: {
                x: Number(value.position?.x ?? 0),
                y: Number(value.position?.y ?? 0),
                z: Number(value.position?.z ?? 0),
                ...(value.position?.yaw !== undefined ? { yaw: Number(value.position.yaw) } : {}),
                ...(value.position?.pitch !== undefined ? { pitch: Number(value.position.pitch) } : {})
            },
            ping: Math.max(0, Number(value.ping ?? 0)),
            isOp: Boolean(value.isOp),
            permissions: Array.isArray(value.permissions) ? value.permissions.map(String) : [],
            edition: 'Java',
            ...(value.deviceType !== undefined ? { deviceType: String(value.deviceType) } : {}),
            ...(value.ipAddress !== undefined ? { ipAddress: String(value.ipAddress) } : {}),
            ...(value.health !== undefined ? { health: Number(value.health) } : {}),
            ...(value.level !== undefined ? { level: Number(value.level) } : {}),
            ...(value.gameMode !== undefined ? { gameMode: String(value.gameMode) } : {}),
            ...(value.isOnline !== undefined ? { isOnline: Boolean(value.isOnline) } : {})
        };
    }
    async getServerInfo() {
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('server.getInfo');
            const responsePayload = this.responseData(response);
            const info = responsePayload?.info || responsePayload;
            if (!info || typeof info !== 'object' || !info.serverId) {
                throw new Error('Java connector returned no server info');
            }
            let metrics = {};
            if (info.tps === undefined || info.memoryUsage === undefined) {
                try {
                    const metricsResponse = await this.sendProtocolRequest('server.getMetrics');
                    const metricsPayload = this.responseData(metricsResponse);
                    metrics = metricsPayload?.metrics || metricsPayload || {};
                }
                catch {
                    // Metric fields remain explicitly unavailable (zero), while the
                    // connector-provided identity and player counts are preserved.
                }
            }
            return {
                serverId: String(info.serverId),
                name: String(info.name ?? this.config?.serverId ?? info.serverId),
                version: String(info.version ?? this.config?.coreVersion ?? 'unknown'),
                coreType: 'Java',
                coreName: String(info.coreName ?? this.config?.coreName ?? 'Java'),
                maxPlayers: Number(info.maxPlayers ?? 0),
                onlinePlayers: Number(info.onlinePlayers ?? info.playerCount ?? 0),
                uptime: Number(info.uptime ?? 0),
                tps: Number(info.tps ?? metrics.tps ?? 0),
                memoryUsage: this.normalizeMemory(info.memoryUsage ?? metrics.memoryUsage),
                worldInfo: Array.isArray(info.worldInfo) ? info.worldInfo : [],
                ...(info.status !== undefined ? { status: String(info.status) } : {}),
                ...(info.online !== undefined ? { online: Boolean(info.online) } : {})
            };
        }
        let version = this.config?.coreVersion || 'unknown';
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
                // Keep identity fields from configuration, but leave live metrics at
                // explicit unavailable values when the legacy command path fails.
            }
        }
        return {
            serverId: this.config?.serverId || 'unknown',
            name: this.config?.name || this.config?.serverId || 'unknown',
            version,
            coreType: 'Java',
            coreName: this.config?.coreName || 'unknown',
            maxPlayers: max,
            onlinePlayers: online,
            uptime: 0,
            // Legacy command adapters do not expose performance metadata.
            tps: 0,
            memoryUsage: { used: 0, max: 0, free: 0, percentage: 0 },
            worldInfo: []
        };
    }
    async getPerformanceMetrics() {
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('server.getMetrics');
            const responsePayload = this.responseData(response);
            const metrics = responsePayload?.metrics || responsePayload;
            if (!metrics || typeof metrics !== 'object' || !metrics.serverId) {
                throw new Error('Java connector returned no performance metrics');
            }
            return {
                serverId: String(metrics.serverId),
                timestamp: Number(metrics.timestamp ?? Date.now()),
                tps: Number(metrics.tps ?? 0),
                cpuUsage: Number(metrics.cpuUsage ?? 0),
                memoryUsage: this.normalizeMemory(metrics.memoryUsage),
                playerCount: Number(metrics.playerCount ?? 0),
                ping: Number(metrics.ping ?? 0)
            };
        }
        let tps = 0;
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
            serverId: this.config?.serverId || 'unknown',
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
                const result = await this.connectionAdapter.sendCommand(command, timeout);
                const rawOutput = result?.output;
                return {
                    success: result?.success === true,
                    output: Array.isArray(rawOutput)
                        ? rawOutput.map(String)
                        : rawOutput === undefined || rawOutput === null
                            ? []
                            : String(rawOutput).split(/\r?\n/).filter(Boolean),
                    executionTime: Number(result?.executionTime ?? result?.execution_time ?? 0),
                    ...(result?.error ? { error: String(result.error) } : {})
                };
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('player.list');
            const responsePayload = this.responseData(response);
            if (!Array.isArray(responsePayload?.players)) {
                throw new Error('Java connector returned no player list');
            }
            return responsePayload.players
                .map((player) => this.normalizePlayer(player))
                .filter((player) => player !== null);
        }
        if (this.connectionAdapter && this.connectionAdapter.sendCommand) {
            try {
                const result = await this.executeCommand('list');
                if (result && result.success && result.output) {
                    const parsed = this.parseListOutput(result.output);
                    if (parsed.online <= 0)
                        return [];
                    // A player count without names is not enough to create player
                    // identities. Do not manufacture `unknown-*` records.
                    if (parsed.names.length === 0)
                        return [];
                    const names = parsed.names.slice(0, parsed.online);
                    return names.map(name => ({
                        // The list command only exposes names. Keep the unified shape and
                        // use explicit unknown-safe values until player.getInfo succeeds.
                        id: name,
                        name,
                        displayName: name,
                        world: 'unknown',
                        position: { x: 0, y: 0, z: 0 },
                        ping: 0,
                        isOp: false,
                        permissions: [],
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
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const response = await this.sendProtocolRequest('player.getInfo', { playerId });
            const responsePayload = this.responseData(response);
            const rawPlayer = responsePayload?.player || responsePayload?.playerInfo;
            const player = this.normalizePlayer(rawPlayer);
            return player ? { ...rawPlayer, ...player } : null;
        }
        if (!this.connectionAdapter || !this.connectionAdapter.sendCommand ||
            !this.connectionAdapter.send || !this.connectionAdapter.pendingRequests) {
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
                op: 'player.getInfo',
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
        const supported = [
            'player_management',
            'world_management',
            'command_execution',
            'performance_monitoring',
            'event_streaming',
            'whitelist_management',
            'ban_management',
            'operator_management',
            'server_control'
        ];
        if (typeof this.connectionAdapter?.sendRequest === 'function') {
            const declared = Array.isArray(this.connectionAdapter.capabilities)
                ? this.connectionAdapter.capabilities.map(String)
                : [];
            return supported.filter(capability => declared.includes(capability));
        }
        return supported;
    }
    hasCapability(capability) {
        return this.getCapabilities().includes(capability);
    }
    async performServerOperation(operation) {
        const startTime = Date.now();
        try {
            let result;
            switch (operation?.type) {
                case 'stop':
                case 'shutdown':
                    result = typeof this.connectionAdapter?.sendRequest === 'function'
                        ? await this.sendProtocolRequest('server.shutdown', {
                            delay: Number(operation.delay ?? 0),
                            message: operation.message
                        }, Number(operation.timeout ?? 30000))
                        : await this.executeCommand('stop', operation.timeout);
                    break;
                case 'restart':
                    result = typeof this.connectionAdapter?.sendRequest === 'function'
                        ? await this.sendProtocolRequest('server.restart', {
                            delay: Number(operation.delay ?? 0),
                            message: operation.message
                        }, Number(operation.timeout ?? 30000))
                        : await this.executeCommand('restart', operation.timeout);
                    break;
                case 'reload':
                    result = await this.executeCommand('reload', operation.timeout);
                    break;
                case 'save':
                    result = await this.executeCommand('save-all', operation.timeout);
                    break;
                default:
                    throw new Error(`Unsupported server operation: ${operation?.type}`);
            }
            const payload = this.responseData(result);
            const success = result?.success !== false && payload?.success !== false;
            return {
                success,
                operation,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                ...(success ? {} : { error: String(result?.error ?? payload?.error ?? 'Server operation failed') })
            };
        }
        catch (error) {
            return {
                success: false,
                operation,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    getBridgeInfo() {
        return {
            serverId: this.config?.serverId || 'unknown',
            coreType: 'Java',
            coreName: this.config?.coreName || 'Paper',
            coreVersion: this.config?.coreVersion || 'unknown',
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
