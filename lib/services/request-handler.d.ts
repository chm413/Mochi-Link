/**
 * WebSocket Request Handler
 *
 * Routes incoming U-WBP v2 requests to appropriate service handlers
 * according to the protocol specification.
 */
import { Context } from 'koishi';
import { UWBPRequest, UWBPResponse, Connection } from '../types';
import { EventService } from './event';
import { ServerManager } from './server';
import { PlayerInformationService } from './player';
import { WhitelistManager } from './whitelist';
import { CommandExecutionService } from './command';
export declare class RequestHandler {
    private ctx;
    private services;
    private logger;
    private subscriptionHandler;
    constructor(ctx: Context, services: {
        event: EventService;
        server: ServerManager;
        player: PlayerInformationService;
        whitelist: WhitelistManager;
        command: CommandExecutionService;
    });
    /**
     * Handle incoming request
     */
    handleRequest(request: UWBPRequest, connection: Connection): Promise<UWBPResponse>;
    /**
     * Route request to appropriate handler
     */
    private routeRequest;
    /**
     * Handle event operations
     */
    private handleEventOperation;
    /**
     * Handle server operations
     */
    private handleServerOperation;
    /**
     * Handle player operations
     */
    private handlePlayerOperation;
    /**
     * Handle whitelist operations
     */
    private handleWhitelistOperation;
    /**
     * Handle command operations
     */
    private handleCommandOperation;
    /**
     * Handle system operations
     */
    private handleSystemOperation;
    private handleServerGetInfo;
    private handleServerGetStatus;
    private handleServerGetMetrics;
    private handleServerSave;
    private handleServerRestart;
    private handleServerShutdown;
    private handlePlayerList;
    private handlePlayerGetInfo;
    private handlePlayerKick;
    private handlePlayerMessage;
    private handleWhitelistGet;
    private handleWhitelistAdd;
    private handleWhitelistRemove;
    private handleCommandExecute;
    private handleSystemPing;
}
