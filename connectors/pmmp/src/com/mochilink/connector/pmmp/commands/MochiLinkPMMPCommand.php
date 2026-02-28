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
 * @version 1.0.0
 */
class MochiLinkPMMPCommand extends Command {
    
    private MochiLinkPMMPPlugin $plugin;
    
    public function __construct(MochiLinkPMMPPlugin $plugin) {
        parent::__construct(
            'mochilink',
            'Main MochiLink command for PMMP',
            '/mochilink <subcommand>',
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
                $this->handleReconnect($sender);
                break;
                
            case 'info':
                $this->handleInfo($sender);
                break;
                
            case 'stats':
                $this->handleStats($sender);
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
        }
    }
    
    /**
     * Handle reconnect subcommand
     */
    private function handleReconnect(CommandSender $sender): void {
        $sender->sendMessage(TextFormat::YELLOW . "Reconnecting to Mochi-Link management server...");
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
     * Send help message
     */
    private function sendHelp(CommandSender $sender): void {
        $sender->sendMessage(TextFormat::GOLD . "=== MochiLink PMMP Commands ===");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink status" . TextFormat::WHITE . " - Check connection status");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink reconnect" . TextFormat::WHITE . " - Reconnect to management server");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink info" . TextFormat::WHITE . " - Show plugin information");
        $sender->sendMessage(TextFormat::YELLOW . "/mochilink stats" . TextFormat::WHITE . " - Show server statistics");
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
