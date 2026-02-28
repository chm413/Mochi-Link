/**
 * Event Subscription Handler
 *
 * Handles U-WBP v2 event subscription and unsubscription requests
 * according to the protocol specification.
 */
import { Context } from 'koishi';
import { UWBPRequest, UWBPResponse, Connection } from '../types';
import { EventService } from './event';
export interface SubscribeRequestData {
    serverId?: string;
    eventTypes?: string[];
    filters?: {
        playerId?: string;
        minPlayerLevel?: number;
        [key: string]: any;
    };
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
export declare class SubscriptionHandler {
    private ctx;
    private eventService;
    private logger;
    private static readonly BASIC_EVENT_TYPES;
    private static readonly EXTENDED_EVENT_TYPES;
    constructor(ctx: Context, eventService: EventService);
    /**
     * 获取基础事件类型列表
     */
    static getBasicEventTypes(): string[];
    /**
     * 获取扩展事件类型列表
     */
    static getExtendedEventTypes(): string[];
    /**
     * 获取所有可用事件类型
     */
    static getAllEventTypes(): string[];
    /**
     * Handle event.subscribe request
     */
    handleSubscribe(request: UWBPRequest, connection: Connection): Promise<UWBPResponse>;
    /**
     * Handle event.unsubscribe request
     */
    handleUnsubscribe(request: UWBPRequest, connection: Connection): Promise<UWBPResponse>;
    /**
     * Handle event.list request (list active subscriptions)
     */
    handleListSubscriptions(request: UWBPRequest, connection: Connection): Promise<UWBPResponse>;
}
