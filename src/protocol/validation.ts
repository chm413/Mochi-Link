/**
 * U-WBP v2 Protocol Message Validation
 * 
 * Provides comprehensive validation for all U-WBP v2 protocol messages
 * including structure validation, data type checking, and business logic validation.
 */

import { 
  UWBPMessage, 
  UWBPRequest, 
  UWBPResponse, 
  UWBPEvent, 
  UWBPSystemMessage,
  ProtocolError 
} from '../types';
import { 
  UWBP_VERSION,
  RequestOperation,
  EventOperation,
  SystemOperation,
  isUWBPMessage,
  isUWBPRequest,
  isUWBPResponse,
  isUWBPEvent,
  isUWBPSystemMessage,
  MessageUtils
} from './messages';

// ============================================================================
// Validation Result Types
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

export interface ValidationWarning {
  field: string;
  message: string;
  code: string;
}

// ============================================================================
// Validation Rules
// ============================================================================

export class ValidationRules {
  // Message ID validation
  static readonly MESSAGE_ID_PATTERN = /^[0-9]+-[a-z0-9]{9}$/;
  static readonly MESSAGE_ID_MAX_LENGTH = 50;

  // Operation validation
  static readonly OPERATION_PATTERN = /^[a-z]+\.[a-zA-Z]+$/;
  static readonly OPERATION_MAX_LENGTH = 100;

  // Server ID validation
  static readonly SERVER_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
  static readonly SERVER_ID_MAX_LENGTH = 64;

  // Data size limits
  static readonly MAX_DATA_SIZE = 1024 * 1024; // 1MB
  static readonly MAX_STRING_LENGTH = 10000;
  static readonly MAX_ARRAY_LENGTH = 1000;

  // Timeout validation
  static readonly MIN_TIMEOUT = 1000; // 1 second
  static readonly MAX_TIMEOUT = 300000; // 5 minutes
}

// ============================================================================
// Message Validator
// ============================================================================

export class MessageValidator {
  /**
   * Validate any U-WBP message
   */
  static validate(message: any): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Basic structure validation
    if (!this.validateBasicStructure(message, result)) {
      result.valid = result.errors.length === 0;
      return result;
    }

    // Type-specific validation
    switch (message.type) {
      case 'request':
        this.validateRequest(message, result);
        break;
      case 'response':
        this.validateResponse(message, result);
        break;
      case 'event':
        this.validateEvent(message, result);
        break;
      case 'system':
        this.validateSystemMessage(message, result);
        break;
      default:
        this.addError(result, 'type', `Unknown message type: ${message.type}`, 'INVALID_TYPE');
    }

    // Set overall validity
    result.valid = result.errors.length === 0;
    return result;
  }

  /**
   * Validate basic message structure
   */
  private static validateBasicStructure(message: any, result: ValidationResult): boolean {
    if (!message || typeof message !== 'object') {
      this.addError(result, 'message', 'Message must be an object', 'INVALID_STRUCTURE');
      return false;
    }

    if (!isUWBPMessage(message)) {
      this.addError(result, 'message', 'Message does not conform to U-WBP format', 'INVALID_FORMAT');
      return false;
    }

    // Validate required fields
    this.validateMessageId(message.id, result);
    this.validateOperation(message.op, result);
    this.validateData(message.data, result);

    // Validate optional fields
    if (message.timestamp !== undefined) {
      this.validateTimestamp(message.timestamp, result);
    }

    if (message.serverId !== undefined) {
      this.validateServerId(message.serverId, result);
    }

    if (message.version !== undefined) {
      this.validateVersion(message.version, result);
    }

    return true; // Continue validation even if there are errors
  }

  /**
   * Validate request message
   */
  private static validateRequest(message: UWBPRequest, result: ValidationResult): void {
    if (!isUWBPRequest(message)) {
      this.addError(result, 'request', 'Invalid request message structure', 'INVALID_REQUEST');
      return;
    }

    // Validate operation is a valid request operation
    if (!this.isValidRequestOperation(message.op)) {
      this.addError(result, 'op', `Invalid request operation: ${message.op}`, 'INVALID_OPERATION');
    }

    // Validate timeout
    if (message.timeout !== undefined) {
      this.validateTimeout(message.timeout, result);
    }

    // Validate operation-specific data
    this.validateRequestData(message.op as RequestOperation, message.data, result);
  }

  /**
   * Validate response message
   */
  private static validateResponse(message: UWBPResponse, result: ValidationResult): void {
    // Validate requestId
    if (!(message as any).requestId || typeof (message as any).requestId !== 'string') {
      this.addError(result, 'requestId', 'Response must have a valid requestId', 'MISSING_REQUEST_ID');
    } else {
      this.validateMessageId((message as any).requestId, result, 'requestId');
    }

    // Validate success field
    if (typeof (message as any).success !== 'boolean') {
      this.addError(result, 'success', 'Response must have a boolean success field', 'INVALID_SUCCESS');
    }

    // Validate error field for failed responses
    if ((message as any).success === false && !(message as any).error) {
      this.addWarning(result, 'error', 'Failed response should include error message', 'MISSING_ERROR');
    }

    if ((message as any).error && typeof (message as any).error !== 'string') {
      this.addError(result, 'error', 'Error field must be a string', 'INVALID_ERROR');
    }
  }

  /**
   * Validate event message
   */
  private static validateEvent(message: UWBPEvent, result: ValidationResult): void {
    // Validate operation is a valid event operation
    if (!this.isValidEventOperation(message.op)) {
      this.addError(result, 'op', `Invalid event operation: ${message.op}`, 'INVALID_OPERATION');
    }

    // Validate eventType
    if (!(message as any).eventType || typeof (message as any).eventType !== 'string') {
      this.addError(result, 'eventType', 'Event must have a valid eventType', 'MISSING_EVENT_TYPE');
    }

    // Events should always have serverId
    if (!message.serverId) {
      this.addWarning(result, 'serverId', 'Event should include serverId', 'MISSING_SERVER_ID');
    }

    // Validate event-specific data
    this.validateEventData(message.op as EventOperation, message.data, result);
  }

  /**
   * Validate system message
   */
  private static validateSystemMessage(message: UWBPSystemMessage, result: ValidationResult): void {
    if (!isUWBPSystemMessage(message)) {
      this.addError(result, 'system', 'Invalid system message structure', 'INVALID_SYSTEM');
      return;
    }

    // Validate systemOp
    if (!this.isValidSystemOperation(message.systemOp)) {
      this.addError(result, 'systemOp', `Invalid system operation: ${message.systemOp}`, 'INVALID_SYSTEM_OP');
    }

    // Validate system-specific data
    this.validateSystemData(message.systemOp, message.data, result);
  }

  // ============================================================================
  // Field Validators
  // ============================================================================

  private static validateMessageId(id: string, result: ValidationResult, field = 'id'): void {
    if (!id || typeof id !== 'string') {
      this.addError(result, field, 'Message ID must be a non-empty string', 'INVALID_ID');
      return;
    }

    if (id.length > ValidationRules.MESSAGE_ID_MAX_LENGTH) {
      this.addError(result, field, `Message ID too long (max ${ValidationRules.MESSAGE_ID_MAX_LENGTH})`, 'ID_TOO_LONG');
    }

    if (!ValidationRules.MESSAGE_ID_PATTERN.test(id)) {
      this.addWarning(result, field, 'Message ID does not follow recommended format', 'ID_FORMAT');
    }
  }

  private static validateOperation(op: string, result: ValidationResult): void {
    if (!op || typeof op !== 'string') {
      this.addError(result, 'op', 'Operation must be a non-empty string', 'INVALID_OPERATION');
      return;
    }

    if (op.length > ValidationRules.OPERATION_MAX_LENGTH) {
      this.addError(result, 'op', `Operation too long (max ${ValidationRules.OPERATION_MAX_LENGTH})`, 'OP_TOO_LONG');
    }

    // System operations don't follow category.action format
    const systemOps = ['ping', 'pong', 'handshake', 'capabilities', 'disconnect', 'error'];
    if (!systemOps.includes(op) && !ValidationRules.OPERATION_PATTERN.test(op)) {
      this.addError(result, 'op', 'Operation must follow format: category.action', 'INVALID_OP_FORMAT');
    }
  }

  private static validateData(data: any, result: ValidationResult): void {
    if (data === undefined || data === null) {
      return; // Data can be null/undefined
    }

    // Check data size
    const dataSize = JSON.stringify(data).length;
    if (dataSize > ValidationRules.MAX_DATA_SIZE) {
      this.addError(result, 'data', `Data too large (max ${ValidationRules.MAX_DATA_SIZE} bytes)`, 'DATA_TOO_LARGE');
    }

    // Validate data structure
    this.validateDataStructure(data, result, 'data');
  }

  private static validateDataStructure(obj: any, result: ValidationResult, path: string): void {
    if (typeof obj === 'string' && obj.length > ValidationRules.MAX_STRING_LENGTH) {
      this.addError(result, path, `String too long (max ${ValidationRules.MAX_STRING_LENGTH})`, 'STRING_TOO_LONG');
    }

    if (Array.isArray(obj)) {
      if (obj.length > ValidationRules.MAX_ARRAY_LENGTH) {
        this.addError(result, path, `Array too long (max ${ValidationRules.MAX_ARRAY_LENGTH})`, 'ARRAY_TOO_LONG');
      }
      obj.forEach((item, index) => {
        this.validateDataStructure(item, result, `${path}[${index}]`);
      });
    }

    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      Object.keys(obj).forEach(key => {
        this.validateDataStructure(obj[key], result, `${path}.${key}`);
      });
    }
  }

  private static validateTimestamp(timestamp: number, result: ValidationResult): void {
    if (typeof timestamp !== 'number' || timestamp <= 0) {
      this.addError(result, 'timestamp', 'Timestamp must be a positive number', 'INVALID_TIMESTAMP');
      return;
    }

    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    
    // Warn if timestamp is more than 1 minute off
    if (diff > 60000) {
      this.addWarning(result, 'timestamp', 'Timestamp differs significantly from current time', 'TIMESTAMP_DRIFT');
    }
  }

  private static validateServerId(serverId: string, result: ValidationResult): void {
    if (!serverId || typeof serverId !== 'string') {
      this.addError(result, 'serverId', 'Server ID must be a non-empty string', 'INVALID_SERVER_ID');
      return;
    }

    if (serverId.length > ValidationRules.SERVER_ID_MAX_LENGTH) {
      this.addError(result, 'serverId', `Server ID too long (max ${ValidationRules.SERVER_ID_MAX_LENGTH})`, 'SERVER_ID_TOO_LONG');
    }

    if (!ValidationRules.SERVER_ID_PATTERN.test(serverId)) {
      this.addError(result, 'serverId', 'Server ID contains invalid characters', 'INVALID_SERVER_ID_FORMAT');
    }
  }

  private static validateVersion(version: string, result: ValidationResult): void {
    if (typeof version !== 'string') {
      this.addError(result, 'version', 'Version must be a string', 'INVALID_VERSION');
      return;
    }

    if (version !== UWBP_VERSION) {
      this.addWarning(result, 'version', `Version mismatch: expected ${UWBP_VERSION}, got ${version}`, 'VERSION_MISMATCH');
    }
  }

  private static validateTimeout(timeout: number, result: ValidationResult): void {
    if (typeof timeout !== 'number' || timeout <= 0) {
      this.addError(result, 'timeout', 'Timeout must be a positive number', 'INVALID_TIMEOUT');
      return;
    }

    if (timeout < ValidationRules.MIN_TIMEOUT) {
      this.addWarning(result, 'timeout', `Timeout too short (min ${ValidationRules.MIN_TIMEOUT}ms)`, 'TIMEOUT_TOO_SHORT');
    }

    if (timeout > ValidationRules.MAX_TIMEOUT) {
      this.addWarning(result, 'timeout', `Timeout too long (max ${ValidationRules.MAX_TIMEOUT}ms)`, 'TIMEOUT_TOO_LONG');
    }
  }

  // ============================================================================
  // Operation Validators
  // ============================================================================

  private static isValidRequestOperation(op: string): boolean {
    const validOps: RequestOperation[] = [
      'server.getInfo', 'server.getStatus', 'server.getMetrics', 'server.shutdown', 'server.restart', 'server.reload', 'server.save',
      'player.list', 'player.getInfo', 'player.kick', 'player.ban', 'player.unban', 'player.message', 'player.teleport',
      'whitelist.get', 'whitelist.add', 'whitelist.remove', 'whitelist.enable', 'whitelist.disable',
      'command.execute', 'command.suggest',
      'world.list', 'world.getInfo', 'world.setTime', 'world.setWeather', 'world.broadcast'
    ];
    return validOps.includes(op as RequestOperation);
  }

  private static isValidEventOperation(op: string): boolean {
    const validOps: EventOperation[] = [
      'player.join', 'player.leave', 'player.chat', 'player.death', 'player.advancement', 'player.move',
      'server.status', 'server.logLine', 'server.metrics',
      'alert.tpsLow', 'alert.memoryHigh', 'alert.playerFlood', 'alert.diskSpace', 'alert.connectionLost'
    ];
    return validOps.includes(op as EventOperation);
  }

  private static isValidSystemOperation(op: string): boolean {
    const validOps: SystemOperation[] = [
      'ping', 'pong', 'handshake', 'capabilities', 'disconnect', 'error'
    ];
    return validOps.includes(op as SystemOperation);
  }

  // ============================================================================
  // Data Validators
  // ============================================================================

  private static validateRequestData(op: RequestOperation, data: any, result: ValidationResult): void {
    // Implement operation-specific data validation
    switch (op) {
      case 'player.kick':
      case 'player.ban':
        if (!data.playerId) {
          this.addError(result, 'data.playerId', 'Player ID is required', 'MISSING_PLAYER_ID');
        }
        break;
      
      case 'player.message':
        if (!data.playerId || !data.message) {
          this.addError(result, 'data', 'Player ID and message are required', 'MISSING_REQUIRED_FIELDS');
        }
        break;
      
      case 'command.execute':
        if (!data.command || typeof data.command !== 'string') {
          this.addError(result, 'data.command', 'Command string is required', 'MISSING_COMMAND');
        }
        break;
      
      case 'whitelist.add':
      case 'whitelist.remove':
        if (!data.playerId) {
          this.addError(result, 'data.playerId', 'Player ID is required', 'MISSING_PLAYER_ID');
        }
        break;
    }
  }

  private static validateEventData(op: EventOperation, data: any, result: ValidationResult): void {
    // Implement event-specific data validation
    switch (op) {
      case 'player.join':
        if (!data.player || !data.player.id || !data.player.name) {
          this.addError(result, 'data', 'Player object with ID and name is required', 'MISSING_PLAYER_INFO');
        }
        break;
      
      case 'player.leave':
        if (!data.playerId && !data.playerName && (!data.player || !data.player.id || !data.player.name)) {
          this.addError(result, 'data', 'Player ID and name are required', 'MISSING_PLAYER_INFO');
        }
        break;
      
      case 'player.chat':
        if (!data.playerId && !data.playerName && !data.message && (!data.player || !data.player.id || !data.player.name)) {
          this.addError(result, 'data', 'Player ID, name, and message are required', 'MISSING_CHAT_INFO');
        }
        break;
      
      case 'server.status':
        if (!data.status) {
          this.addError(result, 'data.status', 'Server status is required', 'MISSING_STATUS');
        }
        break;
    }
  }

  private static validateSystemData(op: SystemOperation, data: any, result: ValidationResult): void {
    // Implement system-specific data validation
    switch (op) {
      case 'handshake':
        if (!data.protocolVersion || !data.serverType) {
          this.addError(result, 'data', 'Protocol version and server type are required', 'MISSING_HANDSHAKE_INFO');
        }
        break;
      
      case 'capabilities':
        if (!Array.isArray(data.capabilities)) {
          this.addError(result, 'data.capabilities', 'Capabilities must be an array', 'INVALID_CAPABILITIES');
        }
        break;
      
      case 'disconnect':
        if (!data.reason) {
          this.addWarning(result, 'data.reason', 'Disconnect reason should be provided', 'MISSING_DISCONNECT_REASON');
        }
        break;
    }
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private static addError(result: ValidationResult, field: string, message: string, code: string): void {
    result.errors.push({
      field,
      message,
      code,
      severity: 'error'
    });
  }

  private static addWarning(result: ValidationResult, field: string, message: string, code: string): void {
    result.warnings.push({
      field,
      message,
      code
    });
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

export class ValidationUtils {
  /**
   * Quick validation check - returns true if message is valid
   */
  static isValid(message: any): boolean {
    return MessageValidator.validate(message).valid;
  }

  /**
   * Validate and throw error if invalid
   */
  static validateOrThrow(message: any): void {
    const result = MessageValidator.validate(message);
    if (!result.valid) {
      const errors = result.errors.map(e => `${e.field}: ${e.message}`).join(', ');
      throw new ProtocolError(`Message validation failed: ${errors}`, message.id);
    }
  }

  /**
   * Get validation summary
   */
  static getValidationSummary(result: ValidationResult): string {
    const errorCount = result.errors.length;
    const warningCount = result.warnings.length;
    
    if (result.valid && warningCount === 0) {
      return 'Valid';
    }
    
    if (result.valid && warningCount > 0) {
      return `Valid with ${warningCount} warning(s)`;
    }
    
    return `Invalid: ${errorCount} error(s), ${warningCount} warning(s)`;
  }
}