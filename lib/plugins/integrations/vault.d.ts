/**
 * Vault Integration
 *
 * Integration with Vault economy system to provide economy balance management,
 * transactions, and permission/chat integration through Vault's unified API.
 */
import { VaultIntegration, PluginInfo, EconomyResult, EconomyInfo, BalanceEntry, PluginConfig, PluginIntegrationFactory, PluginCapability } from '../types';
export declare class VaultPlugin implements VaultIntegration {
    readonly name = "Vault";
    readonly type: "vault";
    readonly version: string;
    readonly capabilities: PluginCapability[];
    private bridge;
    private serverId;
    private _isAvailable;
    private economyPlugin?;
    constructor(config: PluginConfig);
    get isAvailable(): boolean;
    /**
     * Initialize the Vault integration
     */
    initialize(): Promise<void>;
    /**
     * Check if Vault is available and functional
     */
    checkAvailability(): Promise<boolean>;
    /**
     * Get plugin information
     */
    getPluginInfo(): Promise<PluginInfo>;
    /**
     * Get player's balance
     */
    getBalance(playerId: string): Promise<number>;
    /**
     * Check if player has enough money
     */
    has(playerId: string, amount: number): Promise<boolean>;
    /**
     * Withdraw money from player
     */
    withdraw(playerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Deposit money to player
     */
    deposit(playerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Transfer money between players
     */
    transfer(fromPlayerId: string, toPlayerId: string, amount: number, reason?: string): Promise<EconomyResult>;
    /**
     * Get economy information
     */
    getEconomyInfo(): Promise<EconomyInfo>;
    /**
     * Get top balances
     */
    getTopBalances(limit?: number): Promise<BalanceEntry[]>;
    /**
     * Cleanup resources when shutting down
     */
    cleanup(): Promise<void>;
    /**
     * Detect which economy plugin is being used
     */
    private detectEconomyPlugin;
    /**
     * Parse balance from command output
     */
    private parseBalance;
    /**
     * Check if command output contains an error
     */
    private hasError;
    /**
     * Extract error message from command output
     */
    private extractError;
    /**
     * Generate a unique transaction ID
     */
    private generateTransactionId;
    /**
     * Parse top balances from command output
     */
    private parseTopBalances;
}
/**
 * Factory for creating Vault integration instances
 */
export declare class VaultFactory implements PluginIntegrationFactory {
    create(config: PluginConfig): VaultPlugin;
}
