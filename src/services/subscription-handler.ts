/**
 * Event Subscription Handler
 * 
 * Handles U-WBP v2 event subscription and unsubscription requests
 * according to the protocol specification.
 */

import { Context } from 'koishi';
import { 
  UWBPRequest, 
  UWBPResponse,
  Connection 
} from '../types';
import { EventService, EventFilter } from './event';
import { MessageFactory } from '../protocol/messages';

// ============================================================================
// Subscription Request/Response Types
// ============================================================================

export interface SubscribeRequestData {
  serverId?: string;
  eventTypes?: string[];
  filters?: {
    playerId?: string;
    minPlayerLevel?: number;
    [key: string]: any;
  };
  // 是否使用默认订阅（基础事件）
  useDefaults?: boolean;
}

export interface SubscribeResponseData {
  subscriptionId: string;
  serverId?: string;
  eventTypes: string[];
  message: string;
  metadata?: {
    isDefaultSubscription: boolean;
    availableBasicEvents: string[];
    availableExtendedEvents: string[];
  };
}

export interface UnsubscribeRequestData {
  subscriptionId: string;
}

export interface UnsubscribeResponseData {
  subscriptionId: string;
  message: string;
}

// ============================================================================
// Subscription Handler
// ============================================================================

export class SubscriptionHandler {
  private logger: any;

  // 基础事件类型（默认订阅）
  private static readonly BASIC_EVENT_TYPES = [
    'server.start',
    'server.stop',
    'server.status',
    'player.join',
    'player.leave'
  ];

  // 扩展事件类型（不默认订阅，避免负担）
  private static readonly EXTENDED_EVENT_TYPES = [
    'player.chat',
    'player.death',
    'player.advancement',
    'server.logLine',
    'alert.tpsLow',
    'alert.memoryHigh',
    'alert.playerFlood'
  ];

  constructor(
    private ctx: Context,
    private eventService: EventService
  ) {
    this.logger = ctx.logger('mochi-link:subscription');
  }

  /**
   * 获取基础事件类型列表
   */
  static getBasicEventTypes(): string[] {
    return [...SubscriptionHandler.BASIC_EVENT_TYPES];
  }

  /**
   * 获取扩展事件类型列表
   */
  static getExtendedEventTypes(): string[] {
    return [...SubscriptionHandler.EXTENDED_EVENT_TYPES];
  }

  /**
   * 获取所有可用事件类型
   */
  static getAllEventTypes(): string[] {
    return [
      ...SubscriptionHandler.BASIC_EVENT_TYPES,
      ...SubscriptionHandler.EXTENDED_EVENT_TYPES
    ];
  }

  /**
   * Handle event.subscribe request
   */
  async handleSubscribe(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    try {
      const data = request.data as SubscribeRequestData;

      // 确定要订阅的事件类型
      let eventTypes: string[] | undefined;
      
      if (data.useDefaults !== false && (!data.eventTypes || data.eventTypes.length === 0)) {
        // 如果没有指定事件类型且未明确禁用默认订阅，使用基础事件
        eventTypes = SubscriptionHandler.BASIC_EVENT_TYPES;
        this.logger.info(
          `Using default basic event types for ${connection.serverId}`,
          { eventTypes }
        );
      } else if (data.eventTypes && data.eventTypes.length > 0) {
        // 使用指定的事件类型
        eventTypes = data.eventTypes;
        
        // 检查是否包含扩展事件，给出提示
        const extendedEvents = eventTypes.filter(type => 
          SubscriptionHandler.EXTENDED_EVENT_TYPES.includes(type)
        );
        if (extendedEvents.length > 0) {
          this.logger.warn(
            `Subscribing to extended events for ${connection.serverId}. This may increase server load.`,
            { extendedEvents }
          );
        }
      }

      // Build event filter from request data
      const filter: EventFilter = {
        serverId: data.serverId || connection.serverId,
        eventTypes: eventTypes as any[],
        playerId: data.filters?.playerId
      };

      // Create subscription
      const subscription = await this.eventService.subscribe(connection, filter);

      // Build response data
      const responseData: SubscribeResponseData = {
        subscriptionId: subscription.id,
        serverId: subscription.serverId,
        eventTypes: subscription.filter.eventTypes || [],
        message: eventTypes === SubscriptionHandler.BASIC_EVENT_TYPES
          ? 'Successfully subscribed to basic events (default)'
          : 'Successfully subscribed to events',
        metadata: {
          isDefaultSubscription: eventTypes === SubscriptionHandler.BASIC_EVENT_TYPES,
          availableBasicEvents: SubscriptionHandler.BASIC_EVENT_TYPES,
          availableExtendedEvents: SubscriptionHandler.EXTENDED_EVENT_TYPES
        }
      };

      this.logger.info(
        `Event subscription created: ${subscription.id} for ${connection.serverId}`,
        { 
          eventTypes: filter.eventTypes,
          isDefault: eventTypes === SubscriptionHandler.BASIC_EVENT_TYPES
        }
      );

      // Return success response
      return MessageFactory.createResponse(
        request.id,
        'event.subscribe',
        responseData,
        {
          success: true,
          serverId: connection.serverId
        }
      );

    } catch (error) {
      this.logger.error('Failed to handle subscribe request:', error);

      // Return error response
      return MessageFactory.createError(
        request.id,
        'event.subscribe',
        error instanceof Error ? error.message : 'Failed to subscribe to events',
        'SUBSCRIPTION_FAILED',
        { error: String(error) }
      );
    }
  }

  /**
   * Handle event.unsubscribe request
   */
  async handleUnsubscribe(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    try {
      const data = request.data as UnsubscribeRequestData;

      if (!data.subscriptionId) {
        throw new Error('subscriptionId is required');
      }

      // Remove subscription
      await this.eventService.unsubscribe(data.subscriptionId);

      // Build response data
      const responseData: UnsubscribeResponseData = {
        subscriptionId: data.subscriptionId,
        message: 'Successfully unsubscribed from events'
      };

      this.logger.info(
        `Event subscription removed: ${data.subscriptionId} for ${connection.serverId}`
      );

      // Return success response
      return MessageFactory.createResponse(
        request.id,
        'event.unsubscribe',
        responseData,
        {
          success: true,
          serverId: connection.serverId
        }
      );

    } catch (error) {
      this.logger.error('Failed to handle unsubscribe request:', error);

      // Return error response
      return MessageFactory.createError(
        request.id,
        'event.unsubscribe',
        error instanceof Error ? error.message : 'Failed to unsubscribe from events',
        'UNSUBSCRIPTION_FAILED',
        { error: String(error) }
      );
    }
  }

  /**
   * Handle event.list request (list active subscriptions)
   */
  async handleListSubscriptions(
    request: UWBPRequest,
    connection: Connection
  ): Promise<UWBPResponse> {
    try {
      // Get subscriptions for this connection
      const subscriptions = await this.eventService.getSubscriptionsForConnection(
        connection.serverId
      );

      const responseData = {
        subscriptions: subscriptions.map(sub => ({
          id: sub.id,
          serverId: sub.serverId,
          eventTypes: sub.filter.eventTypes || [],
          createdAt: sub.createdAt.toISOString(),
          isActive: sub.isActive
        })),
        total: subscriptions.length
      };

      return MessageFactory.createResponse(
        request.id,
        'event.list',
        responseData,
        {
          success: true,
          serverId: connection.serverId
        }
      );

    } catch (error) {
      this.logger.error('Failed to list subscriptions:', error);

      return MessageFactory.createError(
        request.id,
        'event.list',
        error instanceof Error ? error.message : 'Failed to list subscriptions',
        'LIST_FAILED',
        { error: String(error) }
      );
    }
  }
}
