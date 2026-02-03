/**
 * Plugin Connection Adapter
 * 
 * Handles WebSocket connections to Minecraft server plugins (Connector Bridge).
 * This is the primary connection mode for servers with plugin support.
 */

import WebSocket from 'ws';
import { BaseConnectionAdapter } from './base';
import { 
  ConnectionConfig, 
  UWBPMessage, 
  UWBPSystemMessage,
  CommandResult,
  ConnectionError,
  ProtocolError
} from '../../types';
import { MessageSerializer } from '../../protocol/serialization';

// ============================================================================
// Plugin Connection Adapter
// ============================================================================

export class PluginConnectionAdapter extends BaseConnectionAdapter {
  private ws?: WebSocket;
  private reconnectTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }>();

  constructor(serverId: string) {
    super(serverId, 'plugin');
    this.capabilities = [
      'realtime_events',
      'command_execution',
      'player_management',
      'world_management',
      'plugin_integration'
    ];
  }

  // ============================================================================
  // Connection Implementation
  // ============================================================================

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    const pluginConfig = config.plugin;
    if (!pluginConfig) {
      throw new ConnectionError(
        'Plugin configuration is required',
        this.serverId
      );
    }

    const protocol = pluginConfig.ssl ? 'wss' : 'ws';
    const path = pluginConfig.path || '/ws';
    const url = `${protocol}://${pluginConfig.host}:${pluginConfig.port}${path}`;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(url, {
          headers: {
            'X-Server-ID': this.serverId,
            'X-Connection-Mode': 'plugin'
          }
        });

        this.ws.on('open', () => {
          this.setupHeartbeat();
          resolve();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data);
        });

        this.ws.on('close', (code, reason) => {
          this.handleDisconnection(code, reason.toString());
        });

        this.ws.on('error', (error) => {
          reject(new ConnectionError(
            `WebSocket connection failed: ${error.message}`,
            this.serverId
          ));
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  protected async doDisconnect(): Promise<void> {
    this.clearTimers();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Send disconnect message
      try {
        await this.sendDisconnectMessage();
      } catch (error) {
        // Ignore errors when sending disconnect message
      }
      
      this.ws.close(1000, 'Normal closure');
    }
    
    this.ws = undefined;
  }
  protected async doSendMessage(message: UWBPMessage): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new ConnectionError(
        'WebSocket is not connected',
        this.serverId
      );
    }

    const serialized = MessageSerializer.serialize(message, { validate: true });
    if (!serialized.success) {
      throw new ProtocolError(
        `Failed to serialize message: ${serialized.error}`,
        message.id
      );
    }

    return new Promise((resolve, reject) => {
      this.ws!.send(serialized.data!, (error) => {
        if (error) {
          reject(new ConnectionError(
            `Failed to send message: ${error.message}`,
            this.serverId
          ));
        } else {
          resolve();
        }
      });
    });
  }

  protected async doSendCommand(command: string): Promise<CommandResult> {
    const requestId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const message: UWBPMessage = {
      type: 'request',
      id: requestId,
      op: 'server.command',
      data: { command },
      timestamp: Date.now(),
      serverId: this.serverId,
      version: '2.0'
    };

    // Send command and wait for response
    const response = await this.sendRequestAndWait(message, 30000); // 30 second timeout
    
    if (!response.success) {
      return {
        success: false,
        output: [],
        executionTime: 0,
        error: response.error || 'Command execution failed'
      };
    }

    return {
      success: true,
      output: response.data?.output || [],
      executionTime: response.data?.executionTime || 0
    };
  }

  protected doHealthCheck(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // Message Handling
  // ============================================================================

  private handleMessage(data: WebSocket.Data): void {
    try {
      const messageStr = data.toString();
      const deserialized = MessageSerializer.deserialize(messageStr, { validate: true });
      
      if (!deserialized.success) {
        this.emit('error', new ProtocolError(
          `Failed to deserialize message: ${deserialized.error}`
        ));
        return;
      }

      const message = deserialized.message!;
      this.recordMessage();

      // Handle responses to pending requests
      if (message.type === 'response') {
        this.handleResponse(message);
        return;
      }

      // Handle system messages
      if (message.type === 'system') {
        this.handleSystemMessage(message);
        return;
      }

      // Handle events
      if (message.type === 'event') {
        this.emit('event', message);
        return;
      }

      // Emit generic message event
      this.emit('message', message);

    } catch (error) {
      this.recordError();
      this.emit('error', error);
    }
  }
  private handleResponse(message: UWBPMessage): void {
    const requestId = (message as any).requestId || message.id;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);
      pending.resolve(message);
    }
  }

  private handleSystemMessage(message: UWBPMessage): void {
    const systemOp = (message as any).systemOp;
    
    switch (systemOp) {
      case 'ping':
        this.sendPong(message.id);
        break;
      case 'pong':
        // Update latency
        const pingTime = parseInt(message.id.split('-')[1]);
        if (!isNaN(pingTime)) {
          this._stats.latency = Date.now() - pingTime;
        }
        break;
      case 'capabilities':
        this.capabilities = message.data?.capabilities || [];
        this.emit('capabilitiesUpdated', this.capabilities);
        break;
      case 'disconnect':
        this.emit('remoteDisconnect', message.data?.reason);
        break;
    }
  }

  private handleDisconnection(code: number, reason: string): void {
    this.clearTimers();
    this.rejectPendingRequests(new ConnectionError(
      `Connection closed: ${code} ${reason}`,
      this.serverId
    ));
    
    this.emit('disconnected', code, reason);
  }

  // ============================================================================
  // Request/Response Handling
  // ============================================================================

  private async sendRequestAndWait(message: UWBPMessage, timeout = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(message.id);
        reject(new ConnectionError(
          `Request timeout after ${timeout}ms`,
          this.serverId
        ));
      }, timeout);

      this.pendingRequests.set(message.id, {
        resolve,
        reject,
        timeout: timeoutHandle
      });

      this.doSendMessage(message).catch(reject);
    });
  }

  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  // ============================================================================
  // Heartbeat and System Messages
  // ============================================================================

  private setupHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.sendPing();
    }, 30000); // Ping every 30 seconds
  }

  private async sendPing(): Promise<void> {
    const pingMessage: UWBPSystemMessage = {
      type: 'system',
      id: `ping-${Date.now()}`,
      op: 'ping',
      data: {},
      timestamp: Date.now(),
      serverId: this.serverId,
      version: '2.0',
      systemOp: 'ping'
    };

    try {
      await this.doSendMessage(pingMessage);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async sendPong(pingId: string): Promise<void> {
    const pongMessage: UWBPSystemMessage = {
      type: 'system',
      id: `pong-${Date.now()}`,
      op: 'pong',
      data: { pingId },
      timestamp: Date.now(),
      serverId: this.serverId,
      version: '2.0',
      systemOp: 'pong'
    };

    try {
      await this.doSendMessage(pongMessage);
    } catch (error) {
      this.emit('error', error);
    }
  }

  private async sendDisconnectMessage(): Promise<void> {
    const disconnectMessage: UWBPSystemMessage = {
      type: 'system',
      id: `disconnect-${Date.now()}`,
      op: 'disconnect',
      data: { reason: 'Client disconnect' },
      timestamp: Date.now(),
      serverId: this.serverId,
      version: '2.0',
      systemOp: 'disconnect'
    };

    await this.doSendMessage(disconnectMessage);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }
}