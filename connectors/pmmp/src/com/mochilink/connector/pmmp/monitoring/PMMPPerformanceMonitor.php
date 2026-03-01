<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\monitoring;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
use pocketmine\Server;

/**
 * PMMP Performance Monitor
 * 
 * Monitors PMMP server performance and reports to Mochi-Link management server.
 * Implements U-WBP v2 metrics protocol.
 * 
 * @author chm413
 * @version 1.0.0
 */
class PMMPPerformanceMonitor {
    
    private MochiLinkPMMPPlugin $plugin;
    private PMMPConnectionManager $connectionManager;
    private Server $server;
    
    private bool $running = false;
    private ?\pocketmine\scheduler\TaskHandler $taskHandler = null;
    
    public function __construct(MochiLinkPMMPPlugin $plugin, PMMPConnectionManager $connectionManager) {
        $this->plugin = $plugin;
        $this->connectionManager = $connectionManager;
        $this->server = $plugin->getServer();
    }
    
    /**
     * Start performance monitoring
     */
    public function start(): void {
        if ($this->running) {
            return;
        }
        
        $interval = $this->plugin->getPluginConfig()->getMonitoringInterval();
        
        $this->taskHandler = $this->plugin->getScheduler()->scheduleRepeatingTask(
            new \pocketmine\scheduler\ClosureTask(function(): void {
                $this->collectAndSendMetrics();
            }),
            $interval * 20 // Convert seconds to ticks
        );
        
        $this->running = true;
        $this->plugin->getLogger()->info("Performance monitoring started (interval: {$interval}s)");
    }
    
    /**
     * Stop performance monitoring
     */
    public function stop(): void {
        if (!$this->running) {
            return;
        }
        
        if ($this->taskHandler !== null) {
            $this->taskHandler->cancel();
            $this->taskHandler = null;
        }
        
        $this->running = false;
        $this->plugin->getLogger()->info("Performance monitoring stopped");
    }
    
    /**
     * Collect and send performance metrics
     */
    private function collectAndSendMetrics(): void {
        if (!$this->connectionManager->isConnected()) {
            return;
        }
        
        $metrics = $this->collectMetrics();
        
        $this->connectionManager->sendEvent('server.metrics', [
            'metrics' => $metrics
        ]);
    }
    
    /**
     * Collect performance metrics
     */
    private function collectMetrics(): array {
        $memoryUsed = memory_get_usage(true);
        $memoryMax = $this->parseMemoryLimit(ini_get('memory_limit'));
        
        return [
            'serverId' => $this->plugin->getPluginConfig()->getServerId(),
            'timestamp' => (int)(microtime(true) * 1000),
            'tps' => $this->server->getTicksPerSecond(),
            'cpuUsage' => $this->getCpuUsage(),
            'memoryUsage' => [
                'used' => $memoryUsed,
                'max' => $memoryMax,
                'free' => $memoryMax - $memoryUsed,
                'percentage' => ($memoryUsed / $memoryMax) * 100
            ],
            'playerCount' => count($this->server->getOnlinePlayers()),
            'ping' => $this->getAveragePing(),
            'worldInfo' => $this->getWorldMetrics()
        ];
    }
    
    /**
     * Get CPU usage (approximation)
     */
    private function getCpuUsage(): float {
        // Note: PHP doesn't have a built-in way to get CPU usage
        // This is a placeholder that returns 0
        // For production, consider using system commands or extensions
        return 0.0;
    }
    
    /**
     * Get average player ping
     */
    private function getAveragePing(): int {
        $players = $this->server->getOnlinePlayers();
        if (empty($players)) {
            return 0;
        }
        
        $totalPing = 0;
        foreach ($players as $player) {
            $totalPing += $player->getNetworkSession()->getPing();
        }
        
        return (int)($totalPing / count($players));
    }
    
    /**
     * Get world metrics
     */
    private function getWorldMetrics(): array {
        $worlds = [];
        
        foreach ($this->server->getWorldManager()->getWorlds() as $world) {
            $worlds[] = [
                'name' => $world->getFolderName(),
                'playerCount' => count($world->getPlayers()),
                'loadedChunks' => count($world->getLoadedChunks()),
                'entities' => count($world->getEntities())
            ];
        }
        
        return $worlds;
    }
    
    /**
     * Parse memory limit string to bytes
     */
    private function parseMemoryLimit(string $limit): int {
        $limit = trim($limit);
        $last = strtolower($limit[strlen($limit) - 1]);
        $value = (int)$limit;
        
        return match($last) {
            'g' => $value * 1024 * 1024 * 1024,
            'm' => $value * 1024 * 1024,
            'k' => $value * 1024,
            default => $value
        };
    }
    
    /**
     * Check if monitoring is running
     */
    public function isRunning(): bool {
        return $this->running;
    }
}
