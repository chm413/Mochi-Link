<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp;

use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
use com\mochilink\connector\pmmp\config\PMMPPluginConfig;
use com\mochilink\connector\pmmp\handlers\PMMPEventHandler;
use com\mochilink\connector\pmmp\handlers\PMMPCommandHandler;
use com\mochilink\connector\pmmp\monitoring\PMMPPerformanceMonitor;
use com\mochilink\connector\pmmp\commands\MochiLinkPMMPCommand;
use com\mochilink\connector\pmmp\subscription\SubscriptionManager;

use pocketmine\plugin\PluginBase;
use pocketmine\utils\TextFormat;
use pocketmine\scheduler\AsyncTask;

/**
 * Mochi-Link Connector Plugin for PMMP Servers
 * 
 * This plugin provides integration between PMMP servers and the Mochi-Link
 * unified management system, utilizing PMMP's event system and command API.
 * 
 * @author chm413
 * @version 1.0.0
 */
class MochiLinkPMMPPlugin extends PluginBase {
    
    private static ?MochiLinkPMMPPlugin $instance = null;
    
    // Core components
    private ?PMMPPluginConfig $pluginConfig = null;
    private ?PMMPConnectionManager $connectionManager = null;
    private ?PMMPEventHandler $eventHandler = null;
    private ?PMMPCommandHandler $commandHandler = null;
    private ?PMMPPerformanceMonitor $performanceMonitor = null;
    private ?SubscriptionManager $subscriptionManager = null;
    
    // Plugin state
    private bool $isEnabled = false;
    private bool $isConnected = false;
    
    public function onEnable(): void {
        self::$instance = $this;
        
        try {
            // Initialize plugin
            $this->initializePlugin();
            
            // Start connection
            $this->startConnection();
            
            $this->isEnabled = true;
            $this->getLogger()->info(TextFormat::GREEN . "Mochi-Link PMMP Connector has been enabled successfully!");
            $this->getLogger()->info(TextFormat::GREEN . "大福连 PMMP 版连接器已成功启用！");
            
        } catch (\Exception $e) {
            $this->getLogger()->error("Failed to enable Mochi-Link PMMP Connector: " . $e->getMessage());
            $this->getServer()->getPluginManager()->disablePlugin($this);
        }
    }
    
    public function onDisable(): void {
        try {
            // Disconnect from management server
            if ($this->connectionManager !== null) {
                $this->connectionManager->disconnect();
            }
            
            // Stop performance monitoring
            if ($this->performanceMonitor !== null) {
                $this->performanceMonitor->stop();
            }
            
            // Clear subscriptions
            if ($this->subscriptionManager !== null) {
                $this->subscriptionManager->clearAll();
            }
            
            $this->isEnabled = false;
            $this->isConnected = false;
            
            $this->getLogger()->info(TextFormat::YELLOW . "Mochi-Link PMMP Connector has been disabled.");
            $this->getLogger()->info(TextFormat::YELLOW . "大福连 PMMP 版连接器已禁用。");
            
        } catch (\Exception $e) {
            $this->getLogger()->warning("Error during plugin disable: " . $e->getMessage());
        }
    }
    
    /**
     * Initialize plugin components
     */
    private function initializePlugin(): void {
        $this->getLogger()->info("Initializing Mochi-Link PMMP Connector...");
        
        // Save default config if not exists
        $this->saveDefaultConfig();
        
        // Load configuration
        $this->pluginConfig = new PMMPPluginConfig($this);
        $this->pluginConfig->load();
        
        // Initialize subscription manager
        $this->subscriptionManager = new SubscriptionManager($this->getLogger());
        
        // Initialize connection manager
        $this->connectionManager = new PMMPConnectionManager($this, $this->pluginConfig);
        
        // Initialize event handler
        $this->eventHandler = new PMMPEventHandler($this, $this->connectionManager);
        $this->getServer()->getPluginManager()->registerEvents($this->eventHandler, $this);
        
        // Initialize command handler
        $this->commandHandler = new PMMPCommandHandler($this, $this->connectionManager);
        
        // Register commands
        $this->getServer()->getCommandMap()->register("mochilink", new MochiLinkPMMPCommand($this));
        
        // Initialize performance monitor
        $this->performanceMonitor = new PMMPPerformanceMonitor($this, $this->connectionManager);
        
        $this->getLogger()->info("PMMP plugin components initialized successfully.");
    }
    
    /**
     * Start connection to management server
     */
    private function startConnection(): void {
        $this->getLogger()->info("Starting connection to Mochi-Link management server...");
        
        try {
            $this->connectionManager->connect();
            
            // Start performance monitoring after successful connection
            if ($this->connectionManager->isConnected()) {
                $this->performanceMonitor->start();
                $this->setConnected(true);
                
                $this->getLogger()->info(TextFormat::GREEN . "Successfully connected to Mochi-Link management server!");
                $this->getLogger()->info(TextFormat::GREEN . "已成功连接到大福连管理服务器！");
                
                // Start heartbeat task
                $this->startHeartbeat();
            }
            
        } catch (\Exception $e) {
            $this->getLogger()->warning("Failed to connect to management server: " . $e->getMessage());
            
            // Schedule reconnection if auto-reconnect is enabled
            if ($this->pluginConfig->isAutoReconnectEnabled()) {
                $this->scheduleReconnection();
            }
        }
    }
    
    /**
     * Start heartbeat task
     */
    private function startHeartbeat(): void {
        $this->getScheduler()->scheduleRepeatingTask(
            new \pocketmine\scheduler\ClosureTask(function(): void {
                if ($this->isConnectedToManagement()) {
                    $this->connectionManager->sendHeartbeat();
                }
            }),
            30 * 20 // 30 seconds in ticks
        );
    }
    
    /**
     * Schedule reconnection attempt
     */
    public function scheduleReconnection(): void {
        $reconnectInterval = $this->pluginConfig->getReconnectInterval();
        
        $this->getScheduler()->scheduleDelayedTask(
            new \pocketmine\scheduler\ClosureTask(function(): void {
                if (!$this->isConnected() && $this->isPluginEnabled()) {
                    $this->getLogger()->info("Attempting to reconnect to management server...");
                    $this->startConnection();
                }
            }),
            $reconnectInterval * 20 // Convert seconds to ticks
        );
    }
    
    /**
     * Reconnect to management server
     */
    public function reconnect(): void {
        $this->getLogger()->info("Reconnecting to management server...");
        
        try {
            // Disconnect first
            if ($this->connectionManager->isConnected()) {
                $this->connectionManager->disconnect();
                $this->setConnected(false);
            }
            
            // Wait a moment
            usleep(1000000); // 1 second
            
            // Reconnect
            $this->connectionManager->connect();
            
            if ($this->connectionManager->isConnected()) {
                $this->setConnected(true);
                $this->getLogger()->info(TextFormat::GREEN . "Reconnection successful!");
            }
            
        } catch (\Exception $e) {
            $this->getLogger()->warning("Reconnection failed: " . $e->getMessage());
        }
    }
    
    /**
     * Get plugin instance
     */
    public static function getInstance(): ?MochiLinkPMMPPlugin {
        return self::$instance;
    }
    
    /**
     * Get plugin configuration
     */
    public function getPluginConfig(): ?PMMPPluginConfig {
        return $this->pluginConfig;
    }
    
    /**
     * Get connection manager
     */
    public function getConnectionManager(): ?PMMPConnectionManager {
        return $this->connectionManager;
    }
    
    /**
     * Get event handler
     */
    public function getEventHandler(): ?PMMPEventHandler {
        return $this->eventHandler;
    }
    
    /**
     * Get command handler
     */
    public function getCommandHandler(): ?PMMPCommandHandler {
        return $this->commandHandler;
    }
    
    /**
     * Get performance monitor
     */
    public function getPerformanceMonitor(): ?PMMPPerformanceMonitor {
        return $this->performanceMonitor;
    }
    
    /**
     * Get subscription manager
     */
    public function getSubscriptionManager(): ?SubscriptionManager {
        return $this->subscriptionManager;
    }
    
    /**
     * Check if plugin is properly enabled
     */
    public function isPluginEnabled(): bool {
        return $this->isEnabled;
    }
    
    /**
     * Check if connected to management server
     */
    public function isConnectedToManagement(): bool {
        return $this->isConnected && $this->connectionManager !== null && $this->connectionManager->isConnected();
    }
    
    /**
     * Set connection status
     */
    public function setConnected(bool $connected): void {
        $this->isConnected = $connected;
    }
    
    /**
     * Check if connected
     */
    public function isConnected(): bool {
        return $this->isConnected;
    }
    
    /**
     * Get connection status information
     */
    public function getConnectionStatus(): string {
        if (!$this->isEnabled) {
            return "Plugin Disabled";
        }
        
        if (!$this->isConnected) {
            return "Disconnected";
        }
        
        if ($this->connectionManager !== null && $this->connectionManager->isConnected()) {
            return "Connected (PMMP)";
        }
        
        return "Unknown";
    }

    /**
     * Reload plugin configuration
     */
    public function reloadPluginConfig(): void {
        try {
            // Reload config from file
            $this->reloadConfig();

            // Reload plugin config
            if ($this->pluginConfig !== null) {
                $this->pluginConfig->load();
            }

            $this->getLogger()->info("Configuration reloaded successfully.");

        } catch (\Exception $e) {
            $this->getLogger()->warning("Failed to reload configuration: " . $e->getMessage());
        }
    }

}