/**
 * Mochi-Link (大福连) - Main Plugin Entry Point
 *
 * This is the main entry point for the Koishi plugin that implements
 * the Minecraft Unified Management and Monitoring System.
 */
import { Context, Schema, Service, Logger } from 'koishi';
import { PluginConfig } from './types';
import { DatabaseManager } from './database/init';
import { ServiceManager } from './services';
import { SystemIntegrationService } from './services/system-integration';
import { HealthMonitoringService } from './services/health-monitoring';
export declare const Config: Schema<PluginConfig>;
export declare const name = "mochi-link";
export declare const usage = "\n# Mochi-Link (\u5927\u798F\u8FDE) - Minecraft \u7EDF\u4E00\u7BA1\u7406\u4E0E\u76D1\u63A7\u7CFB\u7EDF\n\n\u8FD9\u662F\u4E00\u4E2A Koishi \u63D2\u4EF6\uFF0C\u63D0\u4F9B\u8DE8\u6838\u5FC3\u3001\u8DE8\u7248\u672C\u3001\u8DE8\u5E73\u53F0\u7684 Minecraft \u670D\u52A1\u5668\u7EDF\u4E00\u7BA1\u7406\u529F\u80FD\u3002\n\n## \u4E3B\u8981\u529F\u80FD\n\n- \uD83C\uDFAF **\u8DE8\u6838\u5FC3\u7EDF\u4E00\u63A5\u53E3**: \u652F\u6301 Java \u7248 (Paper/Folia) \u548C\u57FA\u5CA9\u7248 (LLBDS/PMMP) \u670D\u52A1\u5668\n- \uD83D\uDD17 **\u53CC\u5411\u8FDE\u63A5\u67B6\u6784**: \u652F\u6301\u6B63\u5411\u548C\u53CD\u5411 WebSocket \u8FDE\u63A5\u6A21\u5F0F\n- \uD83D\uDC65 **\u591A\u670D\u52A1\u5668\u7BA1\u7406**: \u5728\u4E00\u4E2A\u5B9E\u4F8B\u4E2D\u7BA1\u7406\u591A\u53F0 MC \u670D\u52A1\u5668\n- \uD83D\uDEE1\uFE0F **\u6743\u9650\u5206\u79BB\u63A7\u5236**: \u57FA\u4E8E\u670D\u52A1\u5668 ID \u7684\u7EC6\u7C92\u5EA6\u6743\u9650\u7BA1\u7406\n- \uD83D\uDCCA **\u5B9E\u65F6\u76D1\u63A7\u63A8\u9001**: \u670D\u52A1\u5668\u72B6\u6001\u3001\u73A9\u5BB6\u6D3B\u52A8\u3001\u6027\u80FD\u6307\u6807\u5B9E\u65F6\u63A8\u9001\n- \uD83D\uDD10 **\u5B89\u5168\u8BA4\u8BC1\u673A\u5236**: API \u4EE4\u724C\u3001IP \u767D\u540D\u5355\u3001\u53EF\u9009\u901A\u4FE1\u52A0\u5BC6\n\n## \u5FEB\u901F\u5F00\u59CB\n\n1. \u786E\u4FDD\u5DF2\u5B89\u88C5\u5E76\u914D\u7F6E\u597D Koishi \u6570\u636E\u5E93\u670D\u52A1\n2. \u5B89\u88C5\u5E76\u542F\u7528\u672C\u63D2\u4EF6\n3. \u914D\u7F6E WebSocket \u548C HTTP \u670D\u52A1\u7AEF\u53E3\n4. \u5728\u76EE\u6807 Minecraft \u670D\u52A1\u5668\u4E0A\u5B89\u88C5\u5BF9\u5E94\u7684 Connector Bridge\n5. \u901A\u8FC7\u7BA1\u7406\u547D\u4EE4\u6CE8\u518C\u670D\u52A1\u5668\u5E76\u5EFA\u7ACB\u8FDE\u63A5\n\n## \u914D\u7F6E\u8BF4\u660E\n\n\u8BF7\u53C2\u8003\u914D\u7F6E\u9762\u677F\u4E2D\u7684\u5404\u9879\u8BBE\u7F6E\uFF0C\u6240\u6709\u914D\u7F6E\u90FD\u6709\u8BE6\u7EC6\u7684\u8BF4\u660E\u548C\u5408\u7406\u7684\u9ED8\u8BA4\u503C\u3002\n\n## \u652F\u6301\u7684\u670D\u52A1\u5668\u6838\u5FC3\n\n### Java \u7248\n- Paper\n- Folia  \n- Fabric\n- Forge\n- Mohist\n- Geyser\n\n### \u57FA\u5CA9\u7248\n- LLBDS\n- Nukkit\n- PMMP\n- BDS (\u5B98\u65B9)\n\n## \u6280\u672F\u7279\u6027\n\n- \u57FA\u4E8E U-WBP v2 \u534F\u8BAE\u7684\u6807\u51C6\u5316\u901A\u4FE1\n- \u652F\u6301\u63D2\u4EF6\u3001RCON\u3001\u7EC8\u7AEF\u6CE8\u5165\u7B49\u591A\u79CD\u63A5\u5165\u6A21\u5F0F\n- \u5B8C\u6574\u7684\u5BA1\u8BA1\u65E5\u5FD7\u548C\u64CD\u4F5C\u8BB0\u5F55\n- \u81EA\u52A8\u91CD\u8FDE\u548C\u6545\u969C\u6062\u590D\u673A\u5236\n- \u975E\u6B63\u7248\u73A9\u5BB6\u8EAB\u4EFD\u8BC6\u522B\u548C\u7BA1\u7406\n- \u79BB\u7EBF\u64CD\u4F5C\u7F13\u5B58\u548C\u540C\u6B65\u673A\u5236\n";
export declare class MochiLinkPlugin extends Service {
    config: PluginConfig;
    static readonly inject: readonly ["database"];
    logger: Logger;
    dbManager: DatabaseManager;
    serviceManager: ServiceManager;
    systemIntegration: SystemIntegrationService;
    healthMonitoring: HealthMonitoringService;
    private dbInitializer;
    private deploymentConfigManager;
    private isInitialized;
    constructor(ctx: Context, config: PluginConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    /**
     * Get plugin health status
     */
    getHealth(): Promise<{
        status: string;
        initialized: boolean;
        uptime: number;
        system?: any;
        deployment?: any;
    }>;
    /**
     * Get plugin configuration
     */
    getConfig(): PluginConfig;
    /**
     * Get system integration service
     */
    getSystemIntegration(): SystemIntegrationService | undefined;
    /**
     * Get health monitoring service
     */
    getHealthMonitoring(): HealthMonitoringService | undefined;
    /**
     * Get service manager (for external access)
     */
    getServiceManager(): ServiceManager | undefined;
    /**
     * Get database manager (for external access)
     */
    getDatabaseManager(): DatabaseManager | undefined;
    /**
     * Check if system is ready
     */
    isReady(): boolean;
    /**
     * Force shutdown (emergency stop)
     */
    forceShutdown(): Promise<void>;
}
export declare function apply(ctx: Context, config: PluginConfig): void;
export declare namespace apply {
    var Config: Schema<PluginConfig>;
}
export * from './types';
export * from './database/models';
