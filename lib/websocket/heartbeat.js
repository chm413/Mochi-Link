"use strict";
/**
 * WebSocket Heartbeat Manager
 *
 * Implements heartbeat mechanism for WebSocket connections to detect
 * connection failures and maintain connection health.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.HeartbeatManager = void 0;
const events_1 = require("events");
const messages_1 = require("../protocol/messages");
// ============================================================================
// Heartbeat Manager
// ============================================================================
class HeartbeatManager extends events_1.EventEmitter {
    constructor(config = {}) {
        super();
        this.connections = new Map();
        this.config = {
            interval: 30000, // 30 seconds
            timeout: 5000, // 5 seconds
            maxMissedBeats: 3, // 3 missed beats
            reconnectOnFailure: true,
            adaptiveInterval: false,
            minInterval: 10000, // 10 seconds
            maxInterval: 120000, // 2 minutes
            ...config
        };
    }
    // ============================================================================
    // Connection Management
    // ============================================================================
    /**
     * Start heartbeat for a connection
     */
    startHeartbeat(connection) {
        const serverId = connection.serverId;
        // Stop existing heartbeat if any
        this.stopHeartbeat(serverId);
        // Initialize heartbeat state
        const state = {
            isActive: true,
            lastPingSent: 0,
            lastPongReceived: Date.now(),
            missedBeats: 0,
            currentInterval: this.config.interval,
            rtt: 0,
            rttHistory: []
        };
        this.connections.set(serverId, state);
        // Set up connection event handlers
        this.setupConnectionHandlers(connection, state);
        // Start heartbeat loop
        this.scheduleNextHeartbeat(connection, state);
        this.emit('heartbeatStarted', serverId);
    }
    /**
     * Stop heartbeat for a connection
     */
    stopHeartbeat(serverId) {
        const state = this.connections.get(serverId);
        if (!state) {
            return;
        }
        state.isActive = false;
        // Clear timers
        if (state.timer) {
            clearTimeout(state.timer);
            state.timer = undefined;
        }
        if (state.timeoutTimer) {
            clearTimeout(state.timeoutTimer);
            state.timeoutTimer = undefined;
        }
        this.connections.delete(serverId);
        this.emit('heartbeatStopped', serverId);
    }
    /**
     * Check if heartbeat is active for connection
     */
    isActive(serverId) {
        const state = this.connections.get(serverId);
        return state?.isActive || false;
    }
    /**
     * Get heartbeat statistics for connection
     */
    getStats(serverId) {
        const state = this.connections.get(serverId);
        if (!state) {
            return null;
        }
        const averageRtt = state.rttHistory.length > 0
            ? state.rttHistory.reduce((sum, rtt) => sum + rtt, 0) / state.rttHistory.length
            : 0;
        return {
            isActive: state.isActive,
            lastPingSent: state.lastPingSent,
            lastPongReceived: state.lastPongReceived,
            missedBeats: state.missedBeats,
            currentInterval: state.currentInterval,
            rtt: state.rtt,
            averageRtt
        };
    }
    // ============================================================================
    // Heartbeat Logic
    // ============================================================================
    setupConnectionHandlers(connection, state) {
        // Handle pong responses
        connection.on('pong', (data) => {
            this.handlePongReceived(connection.serverId, state, data);
        });
        // Handle connection errors
        connection.on('error', () => {
            this.stopHeartbeat(connection.serverId);
        });
        // Handle disconnection
        connection.on('disconnected', () => {
            this.stopHeartbeat(connection.serverId);
        });
    }
    scheduleNextHeartbeat(connection, state) {
        if (!state.isActive) {
            return;
        }
        state.timer = setTimeout(() => {
            this.sendHeartbeat(connection, state);
        }, state.currentInterval);
    }
    sendHeartbeat(connection, state) {
        if (!state.isActive || !connection.isAlive()) {
            return;
        }
        try {
            // Create ping message
            const pingMessage = messages_1.MessageFactory.createSystemMessage('ping', {
                timestamp: Date.now(),
                sequence: state.lastPingSent + 1
            });
            // Send ping (make it synchronous for testing)
            state.lastPingSent = Date.now();
            // Set timeout for pong response immediately
            state.timeoutTimer = setTimeout(() => {
                this.handleHeartbeatTimeout(connection, state);
            }, this.config.timeout);
            // Send the actual message asynchronously but don't wait for it
            connection.send(pingMessage).catch(error => {
                this.emit('heartbeatError', connection.serverId, error);
                this.handleHeartbeatFailure(connection, state);
            });
            this.emit('pingSent', connection.serverId, state.lastPingSent);
            // Schedule next heartbeat
            this.scheduleNextHeartbeat(connection, state);
        }
        catch (error) {
            this.emit('heartbeatError', connection.serverId, error);
            this.handleHeartbeatFailure(connection, state);
        }
    }
    handlePongReceived(serverId, state, data) {
        if (!state.isActive) {
            return;
        }
        const now = Date.now();
        state.lastPongReceived = now;
        state.missedBeats = 0;
        // Calculate RTT
        if (state.lastPingSent > 0) {
            state.rtt = now - state.lastPingSent;
            // Update RTT history for adaptive interval
            state.rttHistory.push(state.rtt);
            if (state.rttHistory.length > 10) {
                state.rttHistory.shift(); // Keep only last 10 RTT measurements
            }
        }
        // Clear timeout timer
        if (state.timeoutTimer) {
            clearTimeout(state.timeoutTimer);
            state.timeoutTimer = undefined;
        }
        // Adjust interval if adaptive heartbeat is enabled
        if (this.config.adaptiveInterval) {
            this.adjustHeartbeatInterval(state);
        }
        this.emit('pongReceived', serverId, state.rtt);
    }
    handleHeartbeatTimeout(connection, state) {
        if (!state.isActive) {
            return;
        }
        state.missedBeats++;
        this.emit('heartbeatTimeout', connection.serverId, state.missedBeats);
        if (state.missedBeats >= this.config.maxMissedBeats) {
            this.handleHeartbeatFailure(connection, state);
        }
        // Note: Next heartbeat is already scheduled in sendHeartbeat, no need to schedule again
    }
    handleHeartbeatFailure(connection, state) {
        const serverId = connection.serverId;
        this.emit('heartbeatFailure', serverId, state.missedBeats);
        // Stop heartbeat
        this.stopHeartbeat(serverId);
        // Trigger reconnection if configured
        if (this.config.reconnectOnFailure) {
            this.emit('reconnectRequired', serverId, 'Heartbeat failure');
        }
    }
    // ============================================================================
    // Adaptive Heartbeat
    // ============================================================================
    adjustHeartbeatInterval(state) {
        if (state.rttHistory.length < 3) {
            return; // Need at least 3 measurements
        }
        const averageRtt = state.rttHistory.reduce((sum, rtt) => sum + rtt, 0) / state.rttHistory.length;
        const maxRtt = Math.max(...state.rttHistory);
        // Adjust interval based on connection quality
        let newInterval;
        if (averageRtt < 100) {
            // Good connection - can use shorter interval
            newInterval = Math.max(this.config.minInterval, this.config.interval * 0.8);
        }
        else if (averageRtt < 500) {
            // Normal connection - use default interval
            newInterval = this.config.interval;
        }
        else {
            // Poor connection - use longer interval
            newInterval = Math.min(this.config.maxInterval, this.config.interval * 1.5);
        }
        // Add some buffer based on max RTT
        newInterval = Math.max(newInterval, maxRtt * 3);
        // Apply the new interval if it's significantly different
        if (Math.abs(newInterval - state.currentInterval) > 100) {
            state.currentInterval = newInterval;
            this.emit('intervalAdjusted', state.currentInterval, averageRtt);
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    getConnectionByServerId(serverId) {
        // This would need to be implemented by the connection manager
        // For now, we'll emit an event to request the connection
        this.emit('connectionRequested', serverId);
        return undefined;
    }
    /**
     * Get overall heartbeat statistics
     */
    getOverallStats() {
        let totalMissedBeats = 0;
        let totalRtt = 0;
        let rttCount = 0;
        const connectionHealth = {};
        for (const [serverId, state] of this.connections) {
            totalMissedBeats += state.missedBeats;
            if (state.rtt > 0) {
                totalRtt += state.rtt;
                rttCount++;
            }
            // Determine connection health
            if (state.missedBeats === 0 && state.rtt < 500) {
                connectionHealth[serverId] = 'healthy';
            }
            else if (state.missedBeats < 2 && state.rtt < 1000) {
                connectionHealth[serverId] = 'degraded';
            }
            else {
                connectionHealth[serverId] = 'unhealthy';
            }
        }
        return {
            activeConnections: this.connections.size,
            totalMissedBeats,
            averageRtt: rttCount > 0 ? totalRtt / rttCount : 0,
            connectionHealth
        };
    }
    /**
     * Update configuration
     */
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        this.emit('configUpdated', this.config);
    }
    /**
     * Shutdown heartbeat manager
     */
    shutdown() {
        // Stop all heartbeats
        const serverIds = Array.from(this.connections.keys());
        for (const serverId of serverIds) {
            this.stopHeartbeat(serverId);
        }
        this.removeAllListeners();
    }
}
exports.HeartbeatManager = HeartbeatManager;
