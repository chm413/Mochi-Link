<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\commands;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use pocketmine\command\Command;
use pocketmine\command\CommandSender;
use pocketmine\utils\TextFormat;

/**
 * MochiLink PMMP Command
 * 
 * Main command for managing MochiLink PMMP connector.
 * 
 * @author chm413
 * @version 2.1.0
 */
class MochiLinkPMMPCommand extends Command {
    
    private MochiLinkPMMPPlugin $plugin;
    
    public function __construct(MochiLinkPMMPPlugin $plugin) {
        parent::__construct(
            'mochilink',
            'Main MochiLink command for PMMP',
            '/mochilink <subcommand> [args]',
            ['ml', 'mochi', 'mlp']
        );
        
        $this->setPermission('mochilink.admin');
        $this->plugin = $plugin;
    }
    
    public function execute(CommandSender $sender, string $commandLabel, array $args): bool {
        if (!$this->testPermission($sender)) {
            return false;
        }
        
        if (empty($args)) {
            $this->sendHelp($sender);
            return true;
        }
        
        $subcommand = strtolower($args[0]);
        
        switch ($subcommand) {
            case 'status':
                $this->handleStatus($sender);
                break;
                
            case 'reconnect':
            case 'retry':
                $this->handleReconnect($sender);
                break;
                
            case 'info':
                $this->handleInfo($sender);
                break;
                
            case 'stats':
                $this->handleStats($sender);
                break;
                
            case 'config':
                $this->handleConfig($sender, array_slice($args, 1));
                break;
                
            case 'reload':
                $this->handleReload($sender);
                break;
                
            case 'subscriptions':
            case 'subs':
                $this->handleSubscriptions($sender);
                break;
                
            case 'reconnection':
            case 'recon':
                $this->handleReconnectionControl($sender, array_slice($args, 1));
                break;
                
            case 'help':
                $this->sendHelp($sender);
                break;
                
            default:
                $sender->sendMessage(TextFormat::RED . "Unknown subcommand: {$subcommand}");
                $this->sendHelp($sender);
        }
        
        return true;
    }
    
    /**
     * Handle status subcommand
     */
    private function handleStatus(CommandSender $sender): void {
        $status = $this->plugin->getConnectionStatus();
        $connected = $this->plugin->isConnectedToManagement();
        
        $sender->sendMessage(TextFormat::GOLD . "=== MochiLink PMMP Status ===");
        $sender->sendMessage(TextFormat::YELLOW . "Plugin: " . 
            ($this->plugin->isPluginEnabled() ? TextFormat::GREEN . "Enabled" : TextFormat::RED . "Disabled"));
        $sender->sendMessage(TextFormat::YELLOW . "Connection: " . 
            ($connected ? TextFormat::GREEN . $status : TextFormat::RED . $status));
        
        if ($this->plugin->getConnectionManager() !== null) {
            $stats = $this->plugin->getConnectionManager()->getConnectionStats();
            $sender->sendMessage(TextFormat::YELLOW . "Queued Messages: " . TextFormat::WHITE . $stats['queuedMessages']);
            $sender->sendMessage(TextFormat::YELLOW . "Pending Messages: " . TextFormat::WHITE . $stats['pendingMessages']);
            
            // 显示重连状态
            if (isset($stats['reconnectAttempts'])) {
                $sender->sendMessage(TextFormat::YELLOW . "Reconnect Attempts: " . TextFormat::WHITE . 
                    $stats['reconnectAttempts'] . "/" . $stats['totalReconnectAttempts']);
                $sender->sendMessage(TextFormat::YELLOW . "Reconnection: " . 
                    ($stats['reconnectionDisabled'] ? TextFormat::RED . "Disabled" : TextFormat::GREEN . "Enabled"));
            }
        }
    }
    
    /**
     * Handle reconnect subcommand
     */
    private function handleReconnect(CommandSender $sender): void {
        $sender->sendMessage(TextFormat::YELLOW . "Reconnecting to Mochi-Link management server...");
        
        // 如果重连被禁用，先启用它
        $connectionManager = $this->plugin->getConnectionManager();
        if ($connectionManager !== null) {
            $status = $connectionManager->getReconnectionStatus();
            if ($status->disabled) {
                $connectionManager->enableReconnection();
                $sender->sendMessage(TextFormat::GREEN . "Reconnection re-enabled!");
            }
        }
        
        $this->plugin->reconnect();
        $sender->sendMessage(TextFormat::GREEN . "Reconnection initiated!");
    }
    
    /**
     * Handle info subcommand
     */
    private function handleInfo(CommandSender $sender): void {
        $config = $this->plugin->getPluginConfig();
        
        $sender->sendMessage(TextFormat::GOLD . "=== MochiLink PMMP Info ===");
        $sender->sendMessage(TextFormat::YELLOW . "Server ID: " . TextFormat::WHITE . $config->getServerId());
        $sender->sendMessage(TextFormat::YELLOW . "Server Name: " . TextFormat::WHITE . $config->getServerName());
        $sender->sendMessage(TextFormat::YELLOW . "Management Host: " . TextFormat::WHITE . 
            $config->getMochiLinkHost() . ":" . $config->getMochiLinkPort());
        $sender->sendMessage(TextFormat::YELLOW . "Protocol Version: " . TextFormat::WHITE . "U-WBP v2.0");
        $sender->sendMessage(TextFormat::YELLOW . "Auto Reconnect: " . 
            ($config->isAutoReconnectEnabled() ? TextFormat::GREEN . "Enabled" : TextFormat::RED . "Disabled"));
        $sender->sendMessage(TextFormat::YELLOW . "Max Retry Attempts: " . TextFormat::WHITE . $config->getRetryAttempts());
    }
    
    /**
     * Handle stats subcommand
     */
    private function handleStats(CommandSender $sender): void {
        $server = $this->plugin->getServer();
        
        $sender->sendMessage(TextFormat::GOLD . "=== Server Statistics ===");
        $sender->sendMessage(TextFormat::YELLOW . "Players: " . TextFormat::WHITE . 
            count($server->getOnlinePlayers()) . "/" . $server->getMaxPlayers());
        $sender->sendMessage(TextFormat::YELLOW . "TPS: " . TextFormat::WHITE . 
            number_format($server->getTicksPerSecond(), 2));
        $sender->sendMessage(TextFormat::YELLOW . "Memory: " . TextFormat::WHITE . 
            number_format(memory_get_usage(true) / 1024 / 1024, 2) . " MB");
        $sender->sendMessage(TextFormat::YELLOW . "Uptime: " . TextFormat::WHITE . 
            $this->formatUptime(time() - $server->getStartTime()));
    }
    
    /**
     * Handle config subcommand
     */
    private function handleConfig(CommandSender $sender, array $args): void {
        if (empty($args)) {
            $sender->sendMessage(TextFormat::RED . "Usage: /mochilink config <get|set> [key] [value]");
            return;
        }
        
        $action = strtolower($args[0]);
        
        switch ($action) {
            case 'get':
                if (empty($args[1])) {
                    $this->showAllConfig($sender);
                } else {
                    $this->getConfigValue($sender, $args[1]);
                }
                break;
                
            case 'set':
                if (empty($args[1]) || empty($args[2])) {
                    $sender->sendMessage(TextFormat::RED . "Usage: /mochilink config set <key> <value>");
                    return;
                }
                $this->setConfigValue($sender, $args[1], $args[2]);
                break;
                
            default:
                $sender->sendMessage(TextFormat::RED . "Unknown config action: {$action}");
                $sender->sendMessage(TextFormat::YELLOW . "Available actions: get, set");
        }
    }
    
    /**
     * Show all config values
     */
    private function showAllConfig(CommandSender $sender): void {
        $config = $this->plugin->getPluginConfig();
        
        $sender->sendMessage(TextFormat::GOLD . "=== MochiLink Configuration ===");
        $sender->sendMessage(TextFormat::YELLOW . "server-id: " . TextFormat::WHITE . $config->getServerId());
        $sender->sendMessage(TextFormat::YELLOW . "server-name: " . TextFormat::WHITE . $config->getServerName());
        $sender->sendMessage(TextFormat::YELLOW . "host: " . TextFormat::WHITE . $config->getMochiLinkHost());
        $sender->sendMessage(TextFormat::YELLOW . "port: " . TextFormat::WHITE . $config->getMochiLinkPort());
        $sender->sendMessage(TextFormat::YELLOW . "auto-reconnect: " . TextFormat::WHITE . 
            ($config->isAutoReconnectEnabled() ? "true" : "false"));
        $sender->sendMessage(TextFormat::YELLOW . "retry-attempts: " . TextFormat::WHITE . $config->getRetryAttempts());
        $sender->sendMessage(TextFormat::YELLOW . "retry-delay: " . TextFormat::WHITE . $config->getRetryDelay() . "ms");
    }
    
    /**
     * Get config value
     */
    private function getConfigValue(CommandSender $sender, string $key): void {
        $config = $this->plugin->getPluginConfig();
        
        $value = match($key) {
            'server-id' => $config->getServerId(),
            'server-name' => $config->getServerName(),
            'host' => $config->getMochiLinkHost(),
            'port' => (string)$config->getMochiLinkPort(),
            'auto-reconnect' => $config->isAutoReconnectEnabled() ? 'true' : 'false',
            'retry-attempts' => (string)$config->getRetryAttempts(),
            'retry-delay' => $config->getRetryDelay() . 'ms',
            default => null
        };
        
        if ($value === null) {
            $sender->sendMessage(TextFormat::RED . "Unknown config key: {$key}");
            return;
        }
        
        $sender->sendMessage(TextFormat::YELLOW . "{$key}: " . TextFormat::WHITE . $value);
    }
    
    /**
     * Set config value
     */
    private function setConfigValue(CommandSender $sender, string $key, string $value): void {
        $sender->sendMessage(TextFormat::YELLOW . "Setting {$key} to {$value}...");
        $sender->sendMessage(TextFormat::GOLD . "Note: Config changes require /mochilink reload to take effect");
        $sender->sendMessage(TextFormat::GOLD . "Please edit config.yml manually and use /mochilink reload");
    }
    
    /**
     * Handle reload subcommand
     */
    private function handleReload(CommandSender $sender): void {
        $sender->sendMessage(TextFormat::YELLOW . "Reloading MochiLink configuration...");
        
        try {
            $this->plugin->reloadPluginConfig();
            $sender->sendMessage(TextFormat::GREEN . "Configuration reloaded successfully!");
            $sender->sendMessage(TextFormat::YELLOW . "Reconnecting with new configuration...");
            $this->plugin->reconnect();
        } catch (\Exception $e) {
            $sender->sendMessage(TextFormat::RED . "Failed to reload configuration: " . $e->getMessage());
        }
    }
    
    /**
     * Handle subscriptions subcommand
     */
    private function handleSubscriptions(CommandSender $sender): void {
        $subscriptionManager = $this->plugin->getSubscriptionManager();
        
        if ($subscriptionManager === null) {
            $sender->sendMessage(TextFormat::RED . "Subscription manager not available");
            return;
        }
        
        $subscriptions = $subscriptionManager->getAllSubscriptions();
        
        $sender->sendMessage(TextFormat::GOLD . "=== Active Event Subscriptions ===");
        
        if (empty($subscriptions)) {
            $sender->sendMessage(TextFormat::GRAY . "No active subscriptions");
            return;
        }
        
        foreach ($subscriptions as $subId => $subscription) {
            $sender->sendMessage(TextFormat::YELLOW . "ID: " . TextFormat::WHITE . $subId);
            $sender->sendMessage(TextFormat::GRAY . "  Events: " . implode(", ", $subscription->getEventTypes()));
            
            $filters = $subscription->getFilters();
            if (!empty($filters)) {
                $sender->sendMessage(TextFormat::GRAY . "  Filters: " . json_encode($filters));
            }
            
            $sender->sendMessage(TextFormat::GRAY . "  Created: " . date('Y-m-d H:i:s', $subscription->getCreatedAt()));
        }
        
        $sender->sendMessage(TextFormat::YELLOW . "Total: " . TextFormat::WHITE . count($subscriptions) . " subscriptions");
    }
    
    /**
     * Handle reconnection control subcommand
     */
    private function handleReconnectionControl(CommandSender $sender, array $args): void {
        $connectionManager = $this->plugin->getConnectionManager();
        
        if ($connectionManager === null) {
            $sender->sendMessage(TextFormat::RED . "Connection manager not available");
            return;
        }
        
        if (empty($args)) {
            // 显示重连状态
            $status = $connectionManager->getReconnectionStatus();
            
            $sender->sendMessage(TextFormat::GOLD . "=== Reconnection Status ===");
            $sender->sendMessage(TextFormat::YELLOW . "Enabled: " . 
                ($status->disabled ? TextFormat::RED . "No" : TextFormat::GREEN . "Yes"));
            $sender->sendMessage(TextFormat::YELLOW . "Currently Reconnecting: " . 
                ($status->isReconnecting ? TextFormat::GREEN . "Yes" : TextFormat::GRAY . "No"));
            $sender->sendMessage(TextFormat::YELLOW . "Current Attempts: " . TextFormat::WHITE . $status->currentAttempts);
            $sender->sendMessage(TextFormat::YELLOW . "Total Attempts: " . TextFormat::WHITE . $status->totalAttempts);
            $sender->sendMessage(TextFormat::YELLOW . "Next Interval: " . TextFormat::WHITE . $status->nextInterval . "ms");
            
            if ($status->lastAttemptTime > 0) {
                $sender->sendMessage(TextFormat::YELLOW . "Last Attempt: " . TextFormat::WHITE . 
                    date('Y-m-d H:i:s', $status->lastAttemptTime));
            }
            
            return;
        }
        
        $action = strtolower($args[0]);
        
        switch ($action) {
            case 'enable':
                $connectionManager->enableReconnection();
                $sender->sendMessage(TextFormat::GREEN . "Reconnection enabled!");
                break;
                
            case 'disable':
                $connectionManager->disableReconnection();
                $sender->sendMessage(TextFormat::YELLOW . "Reconnection disabled!");
                break;
                
            case 'status':
                $this->handleReconnectionControl($sender, []);
                break;
                
            default:
                $sender->sendMessage(TextFormat::RED . "Unknown action: {$action}");
                $sender->sendMessage(TextFormat::YELLOW . "Available actions: enable, disable, status");
        }
    }
    
    /**
     * Send help message
     */
    private function sendHelp(CommandSender $sender): void {
        $sender->sendMessage(TextFormat::GOLD . "=== MochiLink PMMP Commands ===");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink status" . TextFormat::WHITE . " - Check connection status");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink reconnect" . TextFormat::WHITE . " - Manually retry connection");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink info" . TextFormat::WHITE . " - Show plugin information");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink stats" . TextFormat::WHITE . " - Show server statistics");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink config <get|set>" . TextFormat::WHITE . " - Manage configuration");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink reload" . TextFormat::WHITE . " - Reload configuration");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink subscriptions" . TextFormat::WHITE . " - List event subscriptions");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink reconnection <enable|disable|status>" . TextFormat::WHITE . " - Control reconnection");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink help" . TextFormat::WHITE . " - Show this help message");
    }
    
    /**
     * Format uptime
     */
    private function formatUptime(int $seconds): string {
        $days = floor($seconds / 86400);
        $hours = floor(($seconds % 86400) / 3600);
        $minutes = floor(($seconds % 3600) / 60);
        $secs = $seconds % 60;
        
        $parts = [];
        if ($days > 0) $parts[] = "{$days}d";
        if ($hours > 0) $parts[] = "{$hours}h";
        if ($minutes > 0) $parts[] = "{$minutes}m";
        if ($secs > 0 || empty($parts)) $parts[] = "{$secs}s";
        
        return implode(' ', $parts);
    }
}
