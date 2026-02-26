"use strict";
/**
 * Vault Integration
 *
 * Integration with Vault economy system to provide economy balance management,
 * transactions, and permission/chat integration through Vault's unified API.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.VaultFactory = exports.VaultPlugin = void 0;
const types_1 = require("../types");
class VaultPlugin {
    constructor(config) {
        this.name = 'Vault';
        this.type = 'vault';
        this.capabilities = ['economy_balance', 'economy_transactions', 'vault_permissions', 'vault_chat'];
        this._isAvailable = false;
        this.bridge = config.bridge;
        this.serverId = config.serverId;
        this.version = '1.0.0'; // Will be updated during initialization
    }
    get isAvailable() {
        return this._isAvailable;
    }
    /**
     * Initialize the Vault integration
     */
    async initialize() {
        try {
            const available = await this.checkAvailability();
            this._isAvailable = available;
            if (available) {
                await this.detectEconomyPlugin();
            }
        }
        catch (error) {
            console.error('Failed to initialize Vault integration:', error);
            this._isAvailable = false;
        }
    }
    /**
     * Check if Vault is available and functional
     */
    async checkAvailability() {
        try {
            // Try to execute a Vault-related command to check if it's available
            // Since Vault doesn't have direct commands, we'll check for economy plugins
            const result = await this.bridge.executeCommand('plugins');
            return result.success && result.output.some(line => line.toLowerCase().includes('vault') ||
                line.toLowerCase().includes('essentials') ||
                line.toLowerCase().includes('economy'));
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Get plugin information
     */
    async getPluginInfo() {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'getPluginInfo', 'Plugin not available');
        }
        try {
            const result = await this.bridge.executeCommand('plugins');
            const vaultLine = result.output.find(line => line.toLowerCase().includes('vault'));
            // Extract version if available
            let version = 'unknown';
            if (vaultLine) {
                const versionMatch = vaultLine.match(/v?(\d+\.\d+(?:\.\d+)?)/);
                if (versionMatch) {
                    version = versionMatch[1];
                }
            }
            return {
                name: 'Vault',
                version,
                description: 'Vault is a Permissions, Chat, & Economy API',
                authors: ['cereal', 'Sleaker', 'mung3r'],
                enabled: true,
                dependencies: [],
                apiVersion: '1.7.0'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('vault', 'getPluginInfo', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get player's balance
     */
    async getBalance(playerId) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'getBalance', 'Plugin not available');
        }
        try {
            // Try different economy commands based on detected plugin
            let command;
            if (this.economyPlugin === 'essentials') {
                command = `balance ${playerId}`;
            }
            else {
                command = `money ${playerId}`;
            }
            const result = await this.bridge.executeCommand(command);
            if (result.success) {
                return this.parseBalance(result.output);
            }
            return 0;
        }
        catch (error) {
            throw new types_1.PluginOperationError('vault', 'getBalance', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Check if player has enough money
     */
    async has(playerId, amount) {
        try {
            const balance = await this.getBalance(playerId);
            return balance >= amount;
        }
        catch (error) {
            console.error(`Failed to check balance for player ${playerId}:`, error);
            return false;
        }
    }
    /**
     * Withdraw money from player
     */
    async withdraw(playerId, amount, reason) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'withdraw', 'Plugin not available');
        }
        try {
            // Get current balance first
            const currentBalance = await this.getBalance(playerId);
            if (currentBalance < amount) {
                return {
                    success: false,
                    amount,
                    balance: currentBalance,
                    error: 'Insufficient funds'
                };
            }
            // Execute withdraw command
            let command;
            if (this.economyPlugin === 'essentials') {
                command = `eco take ${playerId} ${amount}`;
            }
            else {
                command = `money take ${playerId} ${amount}`;
            }
            const result = await this.bridge.executeCommand(command);
            if (result.success && !this.hasError(result.output)) {
                const newBalance = currentBalance - amount;
                return {
                    success: true,
                    amount,
                    balance: newBalance,
                    transactionId: this.generateTransactionId()
                };
            }
            return {
                success: false,
                amount,
                balance: currentBalance,
                error: this.extractError(result.output) || 'Transaction failed'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('vault', 'withdraw', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Deposit money to player
     */
    async deposit(playerId, amount, reason) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'deposit', 'Plugin not available');
        }
        try {
            // Get current balance first
            const currentBalance = await this.getBalance(playerId);
            // Execute deposit command
            let command;
            if (this.economyPlugin === 'essentials') {
                command = `eco give ${playerId} ${amount}`;
            }
            else {
                command = `money give ${playerId} ${amount}`;
            }
            const result = await this.bridge.executeCommand(command);
            if (result.success && !this.hasError(result.output)) {
                const newBalance = currentBalance + amount;
                return {
                    success: true,
                    amount,
                    balance: newBalance,
                    transactionId: this.generateTransactionId()
                };
            }
            return {
                success: false,
                amount,
                balance: currentBalance,
                error: this.extractError(result.output) || 'Transaction failed'
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('vault', 'deposit', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Transfer money between players
     */
    async transfer(fromPlayerId, toPlayerId, amount, reason) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'transfer', 'Plugin not available');
        }
        try {
            // Check if sender has enough money
            const senderBalance = await this.getBalance(fromPlayerId);
            if (senderBalance < amount) {
                return {
                    success: false,
                    amount,
                    balance: senderBalance,
                    error: 'Insufficient funds'
                };
            }
            // Execute transfer (withdraw from sender, deposit to receiver)
            const withdrawResult = await this.withdraw(fromPlayerId, amount, reason);
            if (!withdrawResult.success) {
                return withdrawResult;
            }
            const depositResult = await this.deposit(toPlayerId, amount, reason);
            if (!depositResult.success) {
                // Rollback the withdrawal
                await this.deposit(fromPlayerId, amount, 'Transfer rollback');
                return depositResult;
            }
            return {
                success: true,
                amount,
                balance: withdrawResult.balance,
                transactionId: this.generateTransactionId()
            };
        }
        catch (error) {
            throw new types_1.PluginOperationError('vault', 'transfer', error instanceof Error ? error.message : String(error));
        }
    }
    /**
     * Get economy information
     */
    async getEconomyInfo() {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'getEconomyInfo', 'Plugin not available');
        }
        // Return default economy info - in a real implementation,
        // this would query the actual economy plugin for its configuration
        return {
            name: this.economyPlugin || 'Unknown Economy',
            currencyName: 'Dollar',
            currencySymbol: '$',
            fractionalDigits: 2,
            supportsBanks: false
        };
    }
    /**
     * Get top balances
     */
    async getTopBalances(limit = 10) {
        if (!this.isAvailable) {
            throw new types_1.PluginOperationError('vault', 'getTopBalances', 'Plugin not available');
        }
        try {
            // Try to get baltop/money top command
            let command;
            if (this.economyPlugin === 'essentials') {
                command = `baltop ${limit}`;
            }
            else {
                command = `money top ${limit}`;
            }
            const result = await this.bridge.executeCommand(command);
            if (result.success) {
                return this.parseTopBalances(result.output);
            }
            return [];
        }
        catch (error) {
            console.error('Failed to get top balances:', error);
            return [];
        }
    }
    /**
     * Cleanup resources when shutting down
     */
    async cleanup() {
        this._isAvailable = false;
    }
    /**
     * Detect which economy plugin is being used
     */
    async detectEconomyPlugin() {
        try {
            const result = await this.bridge.executeCommand('plugins');
            for (const line of result.output) {
                const lowerLine = line.toLowerCase();
                if (lowerLine.includes('essentials')) {
                    this.economyPlugin = 'essentials';
                    break;
                }
                else if (lowerLine.includes('iconomy')) {
                    this.economyPlugin = 'iconomy';
                    break;
                }
                else if (lowerLine.includes('bose')) {
                    this.economyPlugin = 'bose';
                    break;
                }
            }
            if (!this.economyPlugin) {
                this.economyPlugin = 'generic';
            }
        }
        catch (error) {
            console.warn('Could not detect economy plugin:', error);
            this.economyPlugin = 'generic';
        }
    }
    /**
     * Parse balance from command output
     */
    parseBalance(output) {
        for (const line of output) {
            // Look for balance patterns
            const patterns = [
                /balance.*?(\d+(?:\.\d+)?)/i,
                /money.*?(\d+(?:\.\d+)?)/i,
                /\$(\d+(?:\.\d+)?)/,
                /(\d+(?:\.\d+)?)\s*dollars?/i
            ];
            for (const pattern of patterns) {
                const match = line.match(pattern);
                if (match) {
                    return parseFloat(match[1]);
                }
            }
        }
        return 0;
    }
    /**
     * Check if command output contains an error
     */
    hasError(output) {
        return output.some(line => {
            const lowerLine = line.toLowerCase();
            return lowerLine.includes('error') ||
                lowerLine.includes('failed') ||
                lowerLine.includes('insufficient') ||
                lowerLine.includes('not found');
        });
    }
    /**
     * Extract error message from command output
     */
    extractError(output) {
        for (const line of output) {
            const lowerLine = line.toLowerCase();
            if (lowerLine.includes('error') || lowerLine.includes('failed')) {
                return line.trim();
            }
        }
        return null;
    }
    /**
     * Generate a unique transaction ID
     */
    generateTransactionId() {
        return `vault_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    /**
     * Parse top balances from command output
     */
    parseTopBalances(output) {
        const balances = [];
        let rank = 1;
        for (const line of output) {
            // Look for patterns like "1. PlayerName: $1000.00"
            const match = line.match(/^\s*\d+\.\s*(\w+).*?(\d+(?:\.\d+)?)/);
            if (match) {
                const [, playerName, balanceStr] = match;
                const balance = parseFloat(balanceStr);
                balances.push({
                    playerId: playerName, // In a real implementation, this would be UUID
                    playerName,
                    balance,
                    rank: rank++
                });
            }
        }
        return balances;
    }
}
exports.VaultPlugin = VaultPlugin;
/**
 * Factory for creating Vault integration instances
 */
class VaultFactory {
    create(config) {
        return new VaultPlugin(config);
    }
}
exports.VaultFactory = VaultFactory;
