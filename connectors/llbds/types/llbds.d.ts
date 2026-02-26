/**
 * Type definitions for LLBDS (LiteLoaderBDS) runtime environment
 * These globals are provided by the LLBDS server at runtime
 */

declare global {
    /**
     * LLBDS Logger interface
     */
    const logger: {
        info(message: string, ...args: any[]): void;
        warn(message: string, ...args: any[]): void;
        error(message: string, ...args: any[]): void;
        debug(message: string, ...args: any[]): void;
        log(message: string, ...args: any[]): void;
    };

    /**
     * LLBDS Minecraft server interface
     */
    const mc: {
        listen(event: string, callback: (...args: any[]) => void): void;
        getBDSVersion?(): string;
        getTPS?(): number;
        getAvgMSPT?(): number;
        getMaxPlayers?(): number;
        getOnlinePlayers?(): any[];
        runcmd?(command: string): any;
        runcmdEx?(command: string): any;
        regPlayerCmd?(name: string, description: string, callback: (player: any, args?: string[]) => void): void;
        regConsoleCmd?(name: string, description: string, callback: (args?: string[]) => void): void;
    };

    /**
     * LLBDS HTTP Server
     */
    const HttpServer: any;

    /**
     * LLBDS Network utilities
     */
    const network: {
        httpPost?(url: string, data: string, options?: any): Promise<any>;
        httpGet?(url: string, options?: any): Promise<any>;
    };
}

export {};
