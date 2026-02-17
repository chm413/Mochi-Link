/**
 * WebSocket Heartbeat Manager
 *
 * Implements heartbeat mechanism for WebSocket connections to detect
 * connection failures and maintain connection health.
 */
import { EventEmitter } from 'events';
import { WebSocketConnection } from './connection';
export interface HeartbeatConfig {
    interval: number;
    timeout: number;
    maxMissedBeats: number;
    reconnectOnFailure: boolean;
    adaptiveInterval: boolean;
    minInterval: number;
    maxInterval: number;
}
export declare class HeartbeatManager extends EventEmitter {
    private config;
    private connections;
    constructor(config?: Partial<HeartbeatConfig>);
    /**
     * Start heartbeat for a connection
     */
    startHeartbeat(connection: WebSocketConnection): void;
    /**
     * Stop heartbeat for a connection
     */
    stopHeartbeat(serverId: string): void;
    /**
     * Check if heartbeat is active for connection
     */
    isActive(serverId: string): boolean;
    /**
     * Get heartbeat statistics for connection
     */
    getStats(serverId: string): {
        isActive: boolean;
        lastPingSent: number;
        lastPongReceived: number;
        missedBeats: number;
        currentInterval: number;
        rtt: number;
        averageRtt: number;
    } | null;
    private setupConnectionHandlers;
    private scheduleNextHeartbeat;
    private sendHeartbeat;
    private handlePongReceived;
    private handleHeartbeatTimeout;
    private handleHeartbeatFailure;
    private adjustHeartbeatInterval;
    private getConnectionByServerId;
    /**
     * Get overall heartbeat statistics
     */
    getOverallStats(): {
        activeConnections: number;
        totalMissedBeats: number;
        averageRtt: number;
        connectionHealth: Record<string, 'healthy' | 'degraded' | 'unhealthy'>;
    };
    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<HeartbeatConfig>): void;
    /**
     * Shutdown heartbeat manager
     */
    shutdown(): void;
}
