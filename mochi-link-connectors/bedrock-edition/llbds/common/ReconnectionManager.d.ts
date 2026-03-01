import * as winston from 'winston';
/**
 * 通用重连管理器 - 实现指数退避重连机制
 *
 * 特性:
 * - 指数退避算法
 * - 重连次数上限
 * - 达到上限后自动禁用
 * - 手动启用/禁用控制
 *
 * @author Mochi-Link Team
 * @version 2.1.0
 */
/**
 * 重连配置
 */
export interface ReconnectionConfig {
    baseInterval: number;
    maxAttempts: number;
    backoffMultiplier: number;
    maxInterval: number;
    disableOnMaxAttempts: boolean;
}
/**
 * 重连回调接口
 */
export interface ReconnectionCallback {
    /**
     * 执行重连操作
     * @returns 是否成功连接
     */
    attemptReconnect(): Promise<boolean>;
    /**
     * 重连失败回调（可选）
     */
    onReconnecting?(attempts: number, nextInterval: number): void;
    /**
     * 达到最大尝试次数回调（可选）
     */
    onMaxAttemptsReached?(totalAttempts: number): void;
    /**
     * 重连被禁用回调（可选）
     */
    onReconnectionDisabled?(totalAttempts: number): void;
    /**
     * 重连被启用回调（可选）
     */
    onReconnectionEnabled?(): void;
}
/**
 * 重连状态信息
 */
export interface ReconnectionStatus {
    isReconnecting: boolean;
    currentAttempts: number;
    totalAttempts: number;
    nextInterval: number;
    disabled: boolean;
    lastAttemptTime: number;
}
export declare class ReconnectionManager {
    private logger;
    private config;
    private callback;
    private currentAttempts;
    private totalAttempts;
    private isReconnecting;
    private disabled;
    private lastAttemptTime;
    private reconnectTimeout;
    private nextInterval;
    /**
     * 默认配置
     */
    static defaults(): ReconnectionConfig;
    /**
     * 开发环境配置（更快重连）
     */
    static development(): ReconnectionConfig;
    /**
     * 生产环境配置（更保守）
     */
    static production(): ReconnectionConfig;
    /**
     * 构造函数
     */
    constructor(logger: winston.Logger, config: ReconnectionConfig, callback: ReconnectionCallback);
    /**
     * 调度重连
     */
    scheduleReconnect(): void;
    /**
     * 计算指数退避间隔
     */
    private calculateBackoffInterval;
    /**
     * 取消重连
     */
    cancel(): void;
    /**
     * 重置重连状态（连接成功后调用）
     */
    reset(): void;
    /**
     * 启用重连
     */
    enable(): void;
    /**
     * 禁用重连
     */
    disable(): void;
    /**
     * 获取重连状态
     */
    getStatus(): ReconnectionStatus;
    /**
     * 是否已禁用
     */
    isDisabled(): boolean;
    /**
     * 是否正在重连中
     */
    isReconnectingNow(): boolean;
    /**
     * 获取当前尝试次数
     */
    getCurrentAttempts(): number;
    /**
     * 获取总尝试次数
     */
    getTotalAttempts(): number;
}
//# sourceMappingURL=ReconnectionManager.d.ts.map