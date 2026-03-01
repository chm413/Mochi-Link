<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\config;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use pocketmine\utils\Config;

/**
 * PMMP Plugin Configuration Manager
 * 
 * Manages configuration for the Mochi-Link PMMP connector plugin.
 * 
 * @author chm413
 * @version 1.0.0
 */
class PMMPPluginConfig {
    
    private MochiLinkPMMPPlugin $plugin;
    private Config $config;
    
    // Connection settings
    private string $mochiLinkHost = 'localhost';
    private int $mochiLinkPort = 25580;
    private string $mochiLinkPath = '/ws';
    private bool $useSsl = false;
    
    // Server identification
    private string $serverId = '';
    private string $serverName = '';
    private string $authToken = '';
    
    // Connection behavior
    private int $timeout = 10000;
    private int $retryAttempts = 10;
    private int $retryDelay = 5000;
    private bool $autoReconnect = true;
    private int $reconnectInterval = 30;
    
    // Performance monitoring
    private bool $enableMonitoring = true;
    private int $monitoringInterval = 30;
    
    public function __construct(MochiLinkPMMPPlugin $plugin) {
        $this->plugin = $plugin;
    }
    
    /**
     * Load configuration from file
     */
    public function load(): void {
        $this->plugin->saveDefaultConfig();
        $this->config = $this->plugin->getConfig();
        
        // Load connection settings
        $this->mochiLinkHost = $this->config->get('mochi-link-host', 'localhost');
        $this->mochiLinkPort = (int) $this->config->get('mochi-link-port', 25580);
        $this->mochiLinkPath = $this->config->get('mochi-link-path', '/ws');
        $this->useSsl = (bool) $this->config->get('use-ssl', false);
        
        // Load server identification
        $this->serverId = $this->config->get('server-id', $this->generateServerId());
        $this->serverName = $this->config->get('server-name', 'PMMP Server');
        $this->authToken = $this->config->get('auth-token', '');
        
        // Load connection behavior
        $this->timeout = (int) $this->config->get('timeout', 10000);
        $this->retryAttempts = (int) $this->config->get('retry-attempts', 10);
        $this->retryDelay = (int) $this->config->get('retry-delay', 5000);
        $this->autoReconnect = (bool) $this->config->get('auto-reconnect', true);
        $this->reconnectInterval = (int) $this->config->get('reconnect-interval', 30);
        
        // Load monitoring settings
        $this->enableMonitoring = (bool) $this->config->get('enable-monitoring', true);
        $this->monitoringInterval = (int) $this->config->get('monitoring-interval', 30);
        
        // Save config if server ID was generated
        if (!$this->config->exists('server-id')) {
            $this->config->set('server-id', $this->serverId);
            $this->config->save();
        }
    }
    
    /**
     * Generate a unique server ID
     */
    private function generateServerId(): string {
        return 'pmmp-' . bin2hex(random_bytes(8));
    }
    
    // Getters
    public function getMochiLinkHost(): string { return $this->mochiLinkHost; }
    public function getMochiLinkPort(): int { return $this->mochiLinkPort; }
    public function getMochiLinkPath(): string { return $this->mochiLinkPath; }
    public function useSsl(): bool { return $this->useSsl; }
    
    public function getServerId(): string { return $this->serverId; }
    public function getServerName(): string { return $this->serverName; }
    public function getAuthToken(): string { return $this->authToken; }
    
    public function getTimeout(): int { return $this->timeout; }
    public function getRetryAttempts(): int { return $this->retryAttempts; }
    public function getRetryDelay(): int { return $this->retryDelay; }
    public function isAutoReconnectEnabled(): bool { return $this->autoReconnect; }
    public function getReconnectInterval(): int { return $this->reconnectInterval; }
    
    public function isMonitoringEnabled(): bool { return $this->enableMonitoring; }
    public function getMonitoringInterval(): int { return $this->monitoringInterval; }
    
    /**
     * Get WebSocket URL
     */
    public function getWebSocketUrl(): string {
        $protocol = $this->useSsl ? 'wss' : 'ws';
        return sprintf('%s://%s:%d%s', $protocol, $this->mochiLinkHost, $this->mochiLinkPort, $this->mochiLinkPath);
    }
}
