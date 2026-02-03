/**
 * RCON Connection Adapter
 * 
 * Handles RCON (Remote Console) connections to Minecraft servers.
 * This mode is used when servers have RCON enabled but no plugin support.
 */

import { Socket } from 'net';
import { BaseConnectionAdapter } from './base';
import { 
  ConnectionConfig, 
  UWBPMessage, 
  CommandResult,
  ConnectionError
} from '../../types';

// ============================================================================
// RCON Protocol Constants
// ============================================================================

const RCON_PACKET_TYPE = {
  LOGIN: 3,
  COMMAND: 2,
  RESPONSE: 0
};

interface RCONPacket {
  id: number;
  type: number;
  body: string;
}

// ============================================================================
// RCON Connection Adapter
// ============================================================================

export class RCONConnectionAdapter extends BaseConnectionAdapter {
  private socket?: Socket;
  private isAuthenticated = false;
  private requestId = 1;
  private pendingRequests = new Map<number, {
    resolve: (value: CommandResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    command: string;
  }>();
  private buffer = Buffer.alloc(0);

  constructor(serverId: string) {
    super(serverId, 'rcon');
    this.capabilities = [
      'command_execution',
      'console_access',
      'basic_monitoring'
    ];
  }

  // ============================================================================
  // Connection Implementation
  // ============================================================================

  protected async doConnect(config: ConnectionConfig): Promise<void> {
    const rconConfig = config.rcon;
    if (!rconConfig) {
      throw new ConnectionError(
        'RCON configuration is required',
        this.serverId
      );
    }

    return new Promise((resolve, reject) => {
      this.socket = new Socket();
      
      const timeout = setTimeout(() => {
        reject(new ConnectionError(
          `RCON connection timeout to ${rconConfig.host}:${rconConfig.port}`,
          this.serverId
        ));
      }, rconConfig.timeout || 10000);

      this.socket.on('connect', async () => {
        clearTimeout(timeout);
        try {
          await this.authenticate(rconConfig.password);
          resolve();
        } catch (error) {
          reject(error);
        }
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', () => {
        this.handleDisconnection();
      });

      this.socket.on('error', (error) => {
        clearTimeout(timeout);
        reject(new ConnectionError(
          `RCON connection error: ${error.message}`,
          this.serverId
        ));
      });

      this.socket.connect(rconConfig.port, rconConfig.host);
    });
  }

  protected async doDisconnect(): Promise<void> {
    this.isAuthenticated = false;
    this.rejectPendingRequests(new ConnectionError(
      'Connection closed',
      this.serverId
    ));

    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
  }
  protected async doSendMessage(message: UWBPMessage): Promise<void> {
    // RCON doesn't support arbitrary messages, only commands
    if (message.op === 'server.command' && message.data?.command) {
      const result = await this.doSendCommand(message.data.command);
      
      // Emit a synthetic response event
      this.emit('commandResult', {
        requestId: message.id,
        result
      });
      return;
    }

    throw new ConnectionError(
      'RCON adapter only supports command execution',
      this.serverId
    );
  }

  protected async doSendCommand(command: string): Promise<CommandResult> {
    if (!this.isAuthenticated || !this.socket) {
      throw new ConnectionError(
        'RCON not connected or authenticated',
        this.serverId
      );
    }

    const startTime = Date.now();
    const requestId = this.requestId++;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new ConnectionError(
          `RCON command timeout: ${command}`,
          this.serverId
        ));
      }, 30000); // 30 second timeout

      this.pendingRequests.set(requestId, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        },
        timeout,
        command
      });

      try {
        this.sendPacket({
          id: requestId,
          type: RCON_PACKET_TYPE.COMMAND,
          body: command
        });
      } catch (error) {
        this.pendingRequests.delete(requestId);
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  protected doHealthCheck(): boolean {
    return this.socket?.readyState === 'open' && this.isAuthenticated;
  }

  // ============================================================================
  // RCON Protocol Implementation
  // ============================================================================

  private async authenticate(password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const authId = this.requestId++;
      
      const timeout = setTimeout(() => {
        reject(new ConnectionError(
          'RCON authentication timeout',
          this.serverId
        ));
      }, 10000);

      // Set up one-time listener for auth response
      const authHandler = (packet: RCONPacket) => {
        clearTimeout(timeout);
        if (packet.id === authId) {
          this.isAuthenticated = true;
          resolve();
        } else {
          reject(new ConnectionError(
            'RCON authentication failed',
            this.serverId
          ));
        }
      };

      this.once('authResponse', authHandler);

      try {
        this.sendPacket({
          id: authId,
          type: RCON_PACKET_TYPE.LOGIN,
          body: password
        });
      } catch (error) {
        clearTimeout(timeout);
        this.removeListener('authResponse', authHandler);
        reject(error);
      }
    });
  }

  private sendPacket(packet: RCONPacket): void {
    if (!this.socket) {
      throw new ConnectionError('Socket not connected', this.serverId);
    }

    const bodyBuffer = Buffer.from(packet.body, 'utf8');
    const packetBuffer = Buffer.alloc(14 + bodyBuffer.length);
    
    // Packet length (excluding this field)
    packetBuffer.writeInt32LE(10 + bodyBuffer.length, 0);
    
    // Request ID
    packetBuffer.writeInt32LE(packet.id, 4);
    
    // Packet type
    packetBuffer.writeInt32LE(packet.type, 8);
    
    // Body
    bodyBuffer.copy(packetBuffer, 12);
    
    // Null terminators
    packetBuffer.writeInt16LE(0, 12 + bodyBuffer.length);

    this.socket.write(packetBuffer);
  }
  private handleData(data: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, data]);
    
    while (this.buffer.length >= 4) {
      const packetLength = this.buffer.readInt32LE(0);
      const totalLength = packetLength + 4;
      
      if (this.buffer.length < totalLength) {
        break; // Wait for more data
      }
      
      const packetData = this.buffer.slice(0, totalLength);
      this.buffer = this.buffer.slice(totalLength);
      
      try {
        const packet = this.parsePacket(packetData);
        this.handlePacket(packet);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  private parsePacket(data: Buffer): RCONPacket {
    if (data.length < 14) {
      throw new Error('Invalid RCON packet: too short');
    }

    const length = data.readInt32LE(0);
    const id = data.readInt32LE(4);
    const type = data.readInt32LE(8);
    const body = data.slice(12, 12 + length - 10).toString('utf8');

    return { id, type, body };
  }

  private handlePacket(packet: RCONPacket): void {
    this.recordMessage();

    // Handle authentication responses
    if (packet.type === RCON_PACKET_TYPE.COMMAND && !this.isAuthenticated) {
      this.emit('authResponse', packet);
      return;
    }

    // Handle command responses
    if (packet.type === RCON_PACKET_TYPE.RESPONSE) {
      const pending = this.pendingRequests.get(packet.id);
      if (pending) {
        this.pendingRequests.delete(packet.id);
        
        const result: CommandResult = {
          success: true,
          output: packet.body ? packet.body.split('\n').filter(line => line.trim()) : [],
          executionTime: 0 // Will be calculated by the caller
        };
        
        pending.resolve(result);
      }
      return;
    }

    // Emit generic packet event
    this.emit('packet', packet);
  }

  private handleDisconnection(): void {
    this.isAuthenticated = false;
    this.rejectPendingRequests(new ConnectionError(
      'RCON connection closed',
      this.serverId
    ));
    this.emit('disconnected');
  }

  private rejectPendingRequests(error: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  // ============================================================================
  // RCON-Specific Methods
  // ============================================================================

  /**
   * Get server information via RCON commands
   */
  async getServerInfo(): Promise<any> {
    try {
      const [listResult, tpsResult] = await Promise.allSettled([
        this.doSendCommand('list'),
        this.doSendCommand('tps')
      ]);

      const info: any = {
        mode: 'rcon',
        serverId: this.serverId
      };

      if (listResult.status === 'fulfilled') {
        const listOutput = listResult.value.output.join(' ');
        const playerMatch = listOutput.match(/There are (\d+) of a max of (\d+) players online/);
        if (playerMatch) {
          info.onlinePlayers = parseInt(playerMatch[1]);
          info.maxPlayers = parseInt(playerMatch[2]);
        }
      }

      if (tpsResult.status === 'fulfilled') {
        const tpsOutput = tpsResult.value.output.join(' ');
        const tpsMatch = tpsOutput.match(/TPS from last 1m, 5m, 15m: ([\d.]+)/);
        if (tpsMatch) {
          info.tps = parseFloat(tpsMatch[1]);
        }
      }

      return info;
    } catch (error) {
      throw new ConnectionError(
        `Failed to get server info via RCON: ${error instanceof Error ? error.message : String(error)}`,
        this.serverId
      );
    }
  }

  /**
   * Check if server is responsive
   */
  async ping(): Promise<number> {
    const startTime = Date.now();
    try {
      await this.doSendCommand('list');
      return Date.now() - startTime;
    } catch (error) {
      throw new ConnectionError(
        `RCON ping failed: ${error instanceof Error ? error.message : String(error)}`,
        this.serverId
      );
    }
  }
}