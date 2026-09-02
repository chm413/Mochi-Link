/**
 * Java Edition Connector Bridge
 */
export declare class JavaConnectorBridge {
    private config;
    private connectionAdapter;
    private connected;
    constructor(config: any, connectionAdapter?: any);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isHealthy(): Promise<boolean>;
    isConnectedToBridge(): boolean;
    /**
     * 解析 "list" 命令输出：
     * "There are 5 of a max of 20 players online: player1, player2"
     */
    private parseListOutput;
    /** Send a canonical U-WBP request when the adapter supports it. */
    private sendProtocolRequest;
    private responseData;
    private normalizeMemory;
    private normalizePlayer;
    getServerInfo(): Promise<any>;
    getPerformanceMetrics(): Promise<any>;
    executeCommand(command: string, timeout?: number): Promise<any>;
    protected doExecuteCommand(command: string, timeout?: number): Promise<any>;
    getOnlinePlayers(): Promise<any[]>;
    getPlayerDetail(playerId: string): Promise<any>;
    getCapabilities(): string[];
    hasCapability(capability: string): boolean;
    performServerOperation(operation: any): Promise<any>;
    getBridgeInfo(): any;
    performPlayerAction(action: any): Promise<any>;
    private buildPlayerActionCommand;
    performWorldOperation(operation: any): Promise<any>;
    private buildWorldOperationCommand;
    updateWorldSettings(settings: any): Promise<boolean>;
}
