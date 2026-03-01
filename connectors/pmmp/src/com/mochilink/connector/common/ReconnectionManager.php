<?php

declare(strict_types=1);

namespace com\mochilink\connector\common;

use pocketmine\plugin\Plugin;
use pocketmine\scheduler\ClosureTask;
use pocketmine\utils\TextFormat;
use pocketmine\Server;

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
class ReconnectionManager {
    
    private Plugin $plugin;
    private ReconnectionConfig $config;
    private ReconnectionCallback $callback;
    
    // 重连状态
    private int $currentAttempts = 0;
    private int $totalAttempts = 0;
    private bool $isReconnecting = false;
    private bool $disabled = false;
    private int $lastAttemptTime = 0;
    
    private ?int $reconnectTaskId = null;
    private int $nextInterval;
    
    /**
     * 构造函数
     */
    public function __construct(Plugin $plugin, ReconnectionConfig $config, ReconnectionCallback $callback) {
        $this->plugin = $plugin;
        $this->config = $config;
        $this->callback = $callback;
        $this->nextInterval = $config->getBaseInterval();
    }
    
    /**
     * 调度重连
     */
    public function scheduleReconnect(): void {
        // 检查是否已禁用
        if ($this->disabled) {
            $this->plugin->getLogger()->warning('重连已禁用，跳过重连调度');
            $this->callback->onReconnectionDisabled($this->totalAttempts);
            return;
        }
        
        // 检查是否正在重连
        if ($this->isReconnecting) {
            $this->plugin->getLogger()->debug('已在重连中，跳过');
            return;
        }
        
        // 检查是否达到最大尝试次数
        if ($this->currentAttempts >= $this->config->getMaxAttempts()) {
            $this->plugin->getLogger()->warning(
                sprintf('达到最大重连次数 (%d)，停止重连', $this->config->getMaxAttempts())
            );
            $this->callback->onMaxAttemptsReached($this->totalAttempts);
            
            // 自动禁用重连
            if ($this->config->isDisableOnMaxAttempts()) {
                $this->disabled = true;
                $this->plugin->getLogger()->warning('重连已自动禁用');
                $this->callback->onReconnectionDisabled($this->totalAttempts);
            }
            
            return;
        }
        
        // 增加尝试计数
        $this->currentAttempts++;
        $this->totalAttempts++;
        $this->lastAttemptTime = time();
        
        // 计算指数退避间隔
        $this->nextInterval = $this->calculateBackoffInterval($this->currentAttempts);
        
        $this->plugin->getLogger()->info(
            sprintf('调度第 %d 次重连，%d 毫秒后执行 (总尝试: %d)', 
                $this->currentAttempts, $this->nextInterval, $this->totalAttempts)
        );
        
        $this->callback->onReconnecting($this->currentAttempts, $this->nextInterval);
        
        // 标记为重连中
        $this->isReconnecting = true;
        
        // 调度重连任务 (转换毫秒到 ticks: 1秒 = 20 ticks)
        $delayTicks = (int)($this->nextInterval / 50); // 50ms per tick
        
        $this->plugin->getScheduler()->scheduleDelayedTask(
            new ClosureTask(function(): void {
                $this->isReconnecting = false;
                
                try {
                    $this->plugin->getLogger()->info(
                        sprintf('执行第 %d 次重连尝试...', $this->currentAttempts)
                    );
                    
                    $success = $this->callback->attemptReconnect();
                    
                    if ($success) {
                        $this->plugin->getLogger()->info('重连成功！');
                        $this->reset();
                    } else {
                        $this->plugin->getLogger()->warning('重连失败，将继续尝试');
                        // 失败后会由连接断开事件再次触发 scheduleReconnect
                    }
                } catch (\Exception $e) {
                    $this->plugin->getLogger()->error('重连过程中发生异常: ' . $e->getMessage());
                    // 异常后也会由连接断开事件再次触发 scheduleReconnect
                }
            }),
            $delayTicks
        );
    }
    
    /**
     * 计算指数退避间隔
     */
    private function calculateBackoffInterval(int $attempts): int {
        // 指数退避公式: baseInterval * (multiplier ^ (attempts - 1))
        $exponential = $this->config->getBaseInterval() * 
                      pow($this->config->getBackoffMultiplier(), $attempts - 1);
        $interval = (int)$exponential;
        
        // 限制在最大间隔内
        return min($interval, $this->config->getMaxInterval());
    }
    
    /**
     * 取消重连
     */
    public function cancel(): void {
        // Note: PMMP doesn't provide a way to cancel scheduled tasks by ID
        // The task will check isReconnecting flag before executing
        $this->isReconnecting = false;
    }
    
    /**
     * 重置重连状态（连接成功后调用）
     */
    public function reset(): void {
        $this->cancel();
        $this->currentAttempts = 0;
        $this->nextInterval = $this->config->getBaseInterval();
        // 注意: totalAttempts 和 disabled 不重置，用于跟踪生命周期统计
    }
    
    /**
     * 启用重连
     */
    public function enable(): void {
        if (!$this->disabled) {
            $this->plugin->getLogger()->debug('重连已经是启用状态');
            return;
        }
        
        $this->disabled = false;
        $this->currentAttempts = 0;
        $this->nextInterval = $this->config->getBaseInterval();
        
        $this->plugin->getLogger()->info('重连已重新启用');
        $this->callback->onReconnectionEnabled();
    }
    
    /**
     * 禁用重连
     */
    public function disable(): void {
        if ($this->disabled) {
            $this->plugin->getLogger()->debug('重连已经是禁用状态');
            return;
        }
        
        $this->cancel();
        $this->disabled = true;
        
        $this->plugin->getLogger()->info('重连已手动禁用');
        $this->callback->onReconnectionDisabled($this->totalAttempts);
    }
    
    /**
     * 获取重连状态
     */
    public function getStatus(): ReconnectionStatus {
        return new ReconnectionStatus(
            $this->isReconnecting,
            $this->currentAttempts,
            $this->totalAttempts,
            $this->nextInterval,
            $this->disabled,
            $this->lastAttemptTime
        );
    }
    
    /**
     * 是否已禁用
     */
    public function isDisabled(): bool {
        return $this->disabled;
    }
    
    /**
     * 是否正在重连中
     */
    public function isReconnecting(): bool {
        return $this->isReconnecting;
    }
    
    /**
     * 获取当前尝试次数
     */
    public function getCurrentAttempts(): int {
        return $this->currentAttempts;
    }
    
    /**
     * 获取总尝试次数
     */
    public function getTotalAttempts(): int {
        return $this->totalAttempts;
    }
}

/**
 * 重连配置
 */
class ReconnectionConfig {
    
    private int $baseInterval;           // 基础重连间隔(毫秒)
    private int $maxAttempts;            // 最大重连次数
    private float $backoffMultiplier;    // 退避倍数
    private int $maxInterval;            // 最大重连间隔(毫秒)
    private bool $disableOnMaxAttempts;  // 达到上限后自动禁用
    
    public function __construct(
        int $baseInterval,
        int $maxAttempts,
        float $backoffMultiplier,
        int $maxInterval,
        bool $disableOnMaxAttempts
    ) {
        $this->baseInterval = $baseInterval;
        $this->maxAttempts = $maxAttempts;
        $this->backoffMultiplier = $backoffMultiplier;
        $this->maxInterval = $maxInterval;
        $this->disableOnMaxAttempts = $disableOnMaxAttempts;
    }
    
    /**
     * 默认配置
     */
    public static function defaults(): self {
        return new self(
            5000,    // 5秒基础间隔
            10,      // 最多10次
            1.5,     // 1.5倍增长
            60000,   // 最大60秒
            true     // 自动禁用
        );
    }
    
    /**
     * 开发环境配置（更快重连）
     */
    public static function development(): self {
        return new self(
            2000,    // 2秒基础间隔
            5,       // 最多5次
            2.0,     // 2倍增长
            30000,   // 最大30秒
            false    // 不自动禁用
        );
    }
    
    /**
     * 生产环境配置（更保守）
     */
    public static function production(): self {
        return new self(
            10000,   // 10秒基础间隔
            15,      // 最多15次
            1.5,     // 1.5倍增长
            120000,  // 最大2分钟
            true     // 自动禁用
        );
    }
    
    public function getBaseInterval(): int { return $this->baseInterval; }
    public function getMaxAttempts(): int { return $this->maxAttempts; }
    public function getBackoffMultiplier(): float { return $this->backoffMultiplier; }
    public function getMaxInterval(): int { return $this->maxInterval; }
    public function isDisableOnMaxAttempts(): bool { return $this->disableOnMaxAttempts; }
}

/**
 * 重连回调接口
 */
interface ReconnectionCallback {
    
    /**
     * 执行重连操作
     * @return bool 是否成功连接
     */
    public function attemptReconnect(): bool;
    
    /**
     * 重连失败回调（可选）
     */
    public function onReconnecting(int $attempts, int $nextInterval): void;
    
    /**
     * 达到最大尝试次数回调（可选）
     */
    public function onMaxAttemptsReached(int $totalAttempts): void;
    
    /**
     * 重连被禁用回调（可选）
     */
    public function onReconnectionDisabled(int $totalAttempts): void;
    
    /**
     * 重连被启用回调（可选）
     */
    public function onReconnectionEnabled(): void;
}

/**
 * 重连状态信息
 */
class ReconnectionStatus {
    
    public bool $isReconnecting;
    public int $currentAttempts;
    public int $totalAttempts;
    public int $nextInterval;
    public bool $disabled;
    public int $lastAttemptTime;
    
    public function __construct(
        bool $isReconnecting,
        int $currentAttempts,
        int $totalAttempts,
        int $nextInterval,
        bool $disabled,
        int $lastAttemptTime
    ) {
        $this->isReconnecting = $isReconnecting;
        $this->currentAttempts = $currentAttempts;
        $this->totalAttempts = $totalAttempts;
        $this->nextInterval = $nextInterval;
        $this->disabled = $disabled;
        $this->lastAttemptTime = $lastAttemptTime;
    }
    
    public function __toString(): string {
        return sprintf(
            'ReconnectionStatus{reconnecting=%s, attempts=%d, total=%d, nextInterval=%dms, disabled=%s, lastAttempt=%d}',
            $this->isReconnecting ? 'true' : 'false',
            $this->currentAttempts,
            $this->totalAttempts,
            $this->nextInterval,
            $this->disabled ? 'true' : 'false',
            $this->lastAttemptTime
        );
    }
}
