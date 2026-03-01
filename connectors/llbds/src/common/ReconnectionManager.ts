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
    baseInterval: number;           // 基础重连间隔(毫秒)
    maxAttempts: number;            // 最大重连次数
    backoffMultiplier: number;      // 退避倍数
    maxInterval: number;            // 最大重连间隔(毫秒)
    disableOnMaxAttempts: boolean;  // 达到上限后自动禁用
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

export class ReconnectionManager {
    private logger: winston.Logger;
    private config: ReconnectionConfig;
    private callback: ReconnectionCallback;
    
    // 重连状态
    private currentAttempts: number = 0;
    private totalAttempts: number = 0;
    private isReconnecting: boolean = false;
    private disabled: boolean = false;
    private lastAttemptTime: number = 0;
    
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private nextInterval: number;
    
    /**
     * 默认配置
     */
    public static defaults(): ReconnectionConfig {
        return {
            baseInterval: 5000,    // 5秒基础间隔
            maxAttempts: 10,       // 最多10次
            backoffMultiplier: 1.5, // 1.5倍增长
            maxInterval: 60000,    // 最大60秒
            disableOnMaxAttempts: true  // 自动禁用
        };
    }
    
    /**
     * 开发环境配置（更快重连）
     */
    public static development(): ReconnectionConfig {
        return {
            baseInterval: 2000,    // 2秒基础间隔
            maxAttempts: 5,        // 最多5次
            backoffMultiplier: 2.0, // 2倍增长
            maxInterval: 30000,    // 最大30秒
            disableOnMaxAttempts: false  // 不自动禁用
        };
    }
    
    /**
     * 生产环境配置（更保守）
     */
    public static production(): ReconnectionConfig {
        return {
            baseInterval: 10000,   // 10秒基础间隔
            maxAttempts: 15,       // 最多15次
            backoffMultiplier: 1.5, // 1.5倍增长
            maxInterval: 120000,   // 最大2分钟
            disableOnMaxAttempts: true  // 自动禁用
        };
    }
    
    /**
     * 构造函数
     */
    constructor(logger: winston.Logger, config: ReconnectionConfig, callback: ReconnectionCallback) {
        this.logger = logger;
        this.config = config;
        this.callback = callback;
        this.nextInterval = config.baseInterval;
    }
    
    /**
     * 调度重连
     */
    public scheduleReconnect(): void {
        // 检查是否已禁用
        if (this.disabled) {
            this.logger.warn('重连已禁用，跳过重连调度');
            this.callback.onReconnectionDisabled?.(this.totalAttempts);
            return;
        }
        
        // 检查是否正在重连
        if (this.isReconnecting) {
            this.logger.debug('已在重连中，跳过');
            return;
        }
        
        // 检查是否达到最大尝试次数
        if (this.currentAttempts >= this.config.maxAttempts) {
            this.logger.warn(`达到最大重连次数 (${this.config.maxAttempts})，停止重连`);
            this.callback.onMaxAttemptsReached?.(this.totalAttempts);
            
            // 自动禁用重连
            if (this.config.disableOnMaxAttempts) {
                this.disabled = true;
                this.logger.warn('重连已自动禁用');
                this.callback.onReconnectionDisabled?.(this.totalAttempts);
            }
            
            return;
        }
        
        // 增加尝试计数
        this.currentAttempts++;
        this.totalAttempts++;
        this.lastAttemptTime = Date.now();
        
        // 计算指数退避间隔
        this.nextInterval = this.calculateBackoffInterval(this.currentAttempts);
        
        this.logger.info(
            `调度第 ${this.currentAttempts} 次重连，${this.nextInterval} 毫秒后执行 (总尝试: ${this.totalAttempts})`
        );
        
        this.callback.onReconnecting?.(this.currentAttempts, this.nextInterval);
        
        // 标记为重连中
        this.isReconnecting = true;
        
        // 调度重连任务
        this.reconnectTimeout = setTimeout(async () => {
            this.isReconnecting = false;
            
            try {
                this.logger.info(`执行第 ${this.currentAttempts} 次重连尝试...`);
                const success = await this.callback.attemptReconnect();
                
                if (success) {
                    this.logger.info('重连成功！');
                    this.reset();
                } else {
                    this.logger.warn('重连失败，将继续尝试');
                    // 失败后会由连接断开事件再次触发 scheduleReconnect
                }
            } catch (error) {
                this.logger.error('重连过程中发生异常:', error);
                // 异常后也会由连接断开事件再次触发 scheduleReconnect
            }
        }, this.nextInterval);
    }
    
    /**
     * 计算指数退避间隔
     */
    private calculateBackoffInterval(attempts: number): number {
        // 指数退避公式: baseInterval * (multiplier ^ (attempts - 1))
        const exponential = this.config.baseInterval * Math.pow(this.config.backoffMultiplier, attempts - 1);
        const interval = Math.floor(exponential);
        
        // 限制在最大间隔内
        return Math.min(interval, this.config.maxInterval);
    }
    
    /**
     * 取消重连
     */
    public cancel(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        this.isReconnecting = false;
    }
    
    /**
     * 重置重连状态（连接成功后调用）
     */
    public reset(): void {
        this.cancel();
        this.currentAttempts = 0;
        this.nextInterval = this.config.baseInterval;
        // 注意: totalAttempts 和 disabled 不重置，用于跟踪生命周期统计
    }
    
    /**
     * 启用重连
     */
    public enable(): void {
        if (!this.disabled) {
            this.logger.debug('重连已经是启用状态');
            return;
        }
        
        this.disabled = false;
        this.currentAttempts = 0;
        this.nextInterval = this.config.baseInterval;
        
        this.logger.info('重连已重新启用');
        this.callback.onReconnectionEnabled?.();
    }
    
    /**
     * 禁用重连
     */
    public disable(): void {
        if (this.disabled) {
            this.logger.debug('重连已经是禁用状态');
            return;
        }
        
        this.cancel();
        this.disabled = true;
        
        this.logger.info('重连已手动禁用');
        this.callback.onReconnectionDisabled?.(this.totalAttempts);
    }
    
    /**
     * 获取重连状态
     */
    public getStatus(): ReconnectionStatus {
        return {
            isReconnecting: this.isReconnecting,
            currentAttempts: this.currentAttempts,
            totalAttempts: this.totalAttempts,
            nextInterval: this.nextInterval,
            disabled: this.disabled,
            lastAttemptTime: this.lastAttemptTime
        };
    }
    
    /**
     * 是否已禁用
     */
    public isDisabled(): boolean {
        return this.disabled;
    }
    
    /**
     * 是否正在重连中
     */
    public isReconnectingNow(): boolean {
        return this.isReconnecting;
    }
    
    /**
     * 获取当前尝试次数
     */
    public getCurrentAttempts(): number {
        return this.currentAttempts;
    }
    
    /**
     * 获取总尝试次数
     */
    public getTotalAttempts(): number {
        return this.totalAttempts;
    }
}
