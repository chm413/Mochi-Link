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
    getServerInfo(): Promise<any>;
    getPerformanceMetrics(): Promise<any>;
    executeCommand(command: string, timeout?: number): Promise<any>;
    protected doExecuteCommand(command: string, timeout?: number): Promise<any>;
    getOnlinePlayers(): Promise<any[]>;
    getPlayerDetail(playerId: string): Promise<any>;
    getCapabilities(): string[];
    getBridgeInfo(): any;
    performPlayerAction(action: any): Promise<any>;
    performWorldOperation(operation: any): Promise<any>;
    updateWorldSettings(settings: any): Promise<boolean>;
}
