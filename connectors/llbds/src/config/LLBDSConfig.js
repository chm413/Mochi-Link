"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLBDSConfig = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * LLBDS Configuration Manager
 *
 * Manages configuration for the LLBDS connector including
 * server settings, network configuration, and security options.
 *
 * @author chm413
 * @version 1.0.0
 */
class LLBDSConfig {
    constructor(configPath) {
        this.config = {};
        this.configPath = configPath || './config/llbds-config.json';
        this.loadDefaults();
    }
    /**
     * Load configuration from file
     */
    async load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const configData = fs.readFileSync(this.configPath, 'utf8');
                const fileConfig = JSON.parse(configData);
                this.config = { ...this.config, ...fileConfig };
            }
            else {
                // Create default config file
                await this.save();
            }
        }
        catch (error) {
            console.warn('Failed to load LLBDS config, using defaults:', error);
        }
    }
    /**
     * Save configuration to file
     */
    async save() {
        try {
            const configDir = path.dirname(this.configPath);
            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Failed to save LLBDS config:', error);
        }
    }
    /**
     * Load default configuration
     */
    loadDefaults() {
        this.config = {
            server: {
                id: 'llbds-server-1',
                name: 'LLBDS Server',
                description: 'LiteLoaderBDS Server managed by Mochi-Link'
            },
            network: {
                httpPort: 25580,
                externalServicePort: 25581,
                mochiLinkHost: 'localhost',
                mochiLinkPort: 8080,
                mochiLinkPath: '/ws',
                ssl: false,
                timeout: 30000,
                retryAttempts: 5,
                retryDelay: 5000
            },
            authentication: {
                token: '',
                serverId: '',
                encryptionKey: ''
            },
            commands: {
                whitelist: [
                    'list',
                    'say',
                    'tell',
                    'time',
                    'weather',
                    'tp',
                    'gamemode',
                    'give',
                    'effect',
                    'summon',
                    'kill',
                    'kick',
                    'ban',
                    'pardon',
                    'whitelist',
                    'op',
                    'deop'
                ],
                blacklist: [
                    'stop',
                    'restart',
                    'reload',
                    'save-all',
                    'save-off',
                    'save-on'
                ]
            },
            monitoring: {
                enabled: true,
                interval: 30000,
                collectSystemInfo: true,
                collectPlayerInfo: true,
                collectPerformanceInfo: true
            },
            logging: {
                level: 'info',
                file: './logs/llbds-connector.log',
                maxSize: '10MB',
                maxFiles: 5
            }
        };
    }
    // Getter methods
    getServerId() {
        return this.config.server?.id || 'llbds-server-1';
    }
    getServerName() {
        return this.config.server?.name || 'LLBDS Server';
    }
    getHttpPort() {
        return this.config.network?.httpPort || 25580;
    }
    getExternalServicePort() {
        return this.config.network?.externalServicePort || 25581;
    }
    getMochiLinkHost() {
        return this.config.network?.mochiLinkHost || 'localhost';
    }
    getMochiLinkPort() {
        return this.config.network?.mochiLinkPort || 8080;
    }
    getMochiLinkPath() {
        return this.config.network?.mochiLinkPath || '/ws';
    }
    getAuthToken() {
        return this.config.authentication?.token || '';
    }
    getCommandWhitelist() {
        return this.config.commands?.whitelist || [];
    }
    getCommandBlacklist() {
        return this.config.commands?.blacklist || [];
    }
    isMonitoringEnabled() {
        return this.config.monitoring?.enabled !== false;
    }
    getMonitoringInterval() {
        return this.config.monitoring?.interval || 30000;
    }
    getTimeout() {
        return this.config.network?.timeout || 30000;
    }
    getRetryAttempts() {
        return this.config.network?.retryAttempts || 5;
    }
    getRetryDelay() {
        return this.config.network?.retryDelay || 5000;
    }
    // Setter methods
    setServerId(serverId) {
        if (!this.config.server)
            this.config.server = {};
        this.config.server.id = serverId;
    }
    setAuthToken(token) {
        if (!this.config.authentication)
            this.config.authentication = {};
        this.config.authentication.token = token;
    }
    setMochiLinkConnection(host, port, path) {
        if (!this.config.network)
            this.config.network = {};
        this.config.network.mochiLinkHost = host;
        this.config.network.mochiLinkPort = port;
        if (path)
            this.config.network.mochiLinkPath = path;
    }
    /**
     * Get full configuration object
     */
    getConfig() {
        return { ...this.config };
    }
    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
    }
}
exports.LLBDSConfig = LLBDSConfig;
//# sourceMappingURL=LLBDSConfig.js.map