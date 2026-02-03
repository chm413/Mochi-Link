/**
 * Connection Mode Management Types
 * 
 * Type definitions for connection adapters, managers, and related functionality.
 */

import { EventEmitter } from 'events';
import { 
  ConnectionConfig, 
  ConnectionMode, 
  UWBPMessage, 
  ServerConfig,
  CommandResult,
  MochiLinkError
} from '../types';

// ============================================================================
// Connection Adapter Interface
// ============================================================================

export interface ConnectionAdapter extends EventEmitter {
  readonly serverId: string;
  readonly mode: ConnectionMode;
  readonly isConnected: boolean;
  readonly capabilities: string[];
  
  // Connection management
  connect(config: ConnectionConfig): Promise<void>;
  disconnect(): Promise<void>;
  reconnect(): Promise<void>;
  
  // Message handling
  sendMessage(message: UWBPMessage): Promise<void>;
  sendCommand(command: string): Promise<CommandResult>;
  
  // Status and health
  getConnectionInfo(): ConnectionInfo;
  isHealthy(): boolean;
}

// ============================================================================
// Connection Information
// ============================================================================

export interface ConnectionInfo {
  serverId: string;
  mode: ConnectionMode;
  isConnected: boolean;
  connectedAt?: Date;
  lastActivity?: Date;
  capabilities: string[];
  stats: ConnectionStats;
  config: ConnectionConfig;
}

export interface ConnectionStats {
  messagesReceived: number;
  messagesSent: number;
  commandsExecuted: number;
  errors: number;
  uptime: number;
  latency?: number;
}

// ============================================================================
// Connection Errors
// ============================================================================

export class ConnectionModeError extends MochiLinkError {
  constructor(message: string, public mode: ConnectionMode, public serverId: string) {
    super(message, 'CONNECTION_MODE_ERROR', { mode, serverId });
    this.name = 'ConnectionModeError';
  }
}