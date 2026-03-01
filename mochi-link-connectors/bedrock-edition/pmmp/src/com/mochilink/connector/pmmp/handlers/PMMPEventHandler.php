<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\handlers;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
use pocketmine\event\Listener;
use pocketmine\event\player\PlayerJoinEvent;
use pocketmine\event\player\PlayerQuitEvent;
use pocketmine\event\player\PlayerChatEvent;
use pocketmine\event\player\PlayerDeathEvent;
use pocketmine\event\server\DataPacketReceiveEvent;

/**
 * PMMP Event Handler
 * 
 * Handles PMMP server events and forwards them to Mochi-Link management server.
 * Implements U-WBP v2 event protocol.
 * 
 * @author chm413
 * @version 1.0.0
 */
class PMMPEventHandler implements Listener {
    
    private MochiLinkPMMPPlugin $plugin;
    private PMMPConnectionManager $connectionManager;
    
    public function __construct(MochiLinkPMMPPlugin $plugin, PMMPConnectionManager $connectionManager) {
        $this->plugin = $plugin;
        $this->connectionManager = $connectionManager;
    }
    
    /**
     * Handle player join event
     */
    public function onPlayerJoin(PlayerJoinEvent $event): void {
        // Check subscription
        if (!$this->plugin->getSubscriptionManager()->hasSubscription('player.join')) {
            return;
        }
        
        $player = $event->getPlayer();
        
        $eventData = [
            'player' => [
                'id' => $player->getUniqueId()->toString(),
                'name' => $player->getName(),
                'displayName' => $player->getDisplayName(),
                'world' => $player->getWorld()->getFolderName(),
                'position' => [
                    'x' => $player->getPosition()->getX(),
                    'y' => $player->getPosition()->getY(),
                    'z' => $player->getPosition()->getZ()
                ],
                'ping' => $player->getNetworkSession()->getPing(),
                'ipAddress' => $player->getNetworkSession()->getIp(),
                'deviceType' => $this->getDeviceType($player),
                'edition' => 'Bedrock'
            ],
            'firstJoin' => !$player->hasPlayedBefore(),
            'joinMessage' => $event->getJoinMessage()
        ];
        
        // Check filters
        $filterData = [
            'firstJoin' => !$player->hasPlayedBefore()
        ];
        
        if (!$this->plugin->getSubscriptionManager()->matchesFilters('player.join', $filterData)) {
            return;
        }
        
        $this->connectionManager->sendEvent('player.join', $eventData);
    }
    
    /**
     * Handle player quit event
     */
    public function onPlayerQuit(PlayerQuitEvent $event): void {
        // Check subscription
        if (!$this->plugin->getSubscriptionManager()->hasSubscription('player.leave')) {
            return;
        }
        
        $player = $event->getPlayer();
        
        $eventData = [
            'playerId' => $player->getUniqueId()->toString(),
            'playerName' => $player->getName(),
            'reason' => 'quit',
            'quitMessage' => $event->getQuitMessage()
        ];
        
        // Check filters
        $filterData = [
            'reason' => 'quit'
        ];
        
        if (!$this->plugin->getSubscriptionManager()->matchesFilters('player.leave', $filterData)) {
            return;
        }
        
        $this->connectionManager->sendEvent('player.leave', $eventData);
    }
    
    /**
     * Handle player chat event
     */
    public function onPlayerChat(PlayerChatEvent $event): void {
        if ($event->isCancelled()) {
            return;
        }
        
        // Check subscription
        if (!$this->plugin->getSubscriptionManager()->hasSubscription('player.chat')) {
            return;
        }
        
        $player = $event->getPlayer();
        
        $eventData = [
            'playerId' => $player->getUniqueId()->toString(),
            'playerName' => $player->getName(),
            'message' => $event->getMessage(),
            'recipients' => array_map(
                fn($p) => $p->getName(),
                $event->getRecipients()
            )
        ];
        
        // Check filters
        $filterData = [
            'message' => $event->getMessage()
        ];
        
        if (!$this->plugin->getSubscriptionManager()->matchesFilters('player.chat', $filterData)) {
            return;
        }
        
        $this->connectionManager->sendEvent('player.chat', $eventData);
    }
    
    /**
     * Handle player death event
     */
    public function onPlayerDeath(PlayerDeathEvent $event): void {
        // Check subscription
        if (!$this->plugin->getSubscriptionManager()->hasSubscription('player.death')) {
            return;
        }
        
        $player = $event->getPlayer();
        $cause = $player->getLastDamageCause();
        
        $eventData = [
            'playerId' => $player->getUniqueId()->toString(),
            'playerName' => $player->getName(),
            'cause' => $cause !== null ? $cause->getCause()->name : 'unknown',
            'deathMessage' => $event->getDeathMessage(),
            'location' => [
                'world' => $player->getWorld()->getFolderName(),
                'x' => $player->getPosition()->getX(),
                'y' => $player->getPosition()->getY(),
                'z' => $player->getPosition()->getZ()
            ]
        ];
        
        // Check filters
        $filterData = [
            'cause' => $cause !== null ? $cause->getCause()->name : 'unknown'
        ];
        
        if (!$this->plugin->getSubscriptionManager()->matchesFilters('player.death', $filterData)) {
            return;
        }
        
        $this->connectionManager->sendEvent('player.death', $eventData);
    }
    
    /**
     * Get device type from player
     */
    private function getDeviceType(\pocketmine\player\Player $player): string {
        $session = $player->getNetworkSession();
        $info = $session->getPlayerInfo();
        
        if ($info === null) {
            return 'Unknown';
        }
        
        $deviceOS = $info->getExtraData()['DeviceOS'] ?? -1;
        
        return match($deviceOS) {
            1 => 'Android',
            2 => 'iOS',
            3 => 'macOS',
            4 => 'FireOS',
            5 => 'GearVR',
            6 => 'HoloLens',
            7 => 'Windows 10',
            8 => 'Windows',
            9 => 'Dedicated',
            10 => 'tvOS',
            11 => 'PlayStation',
            12 => 'Nintendo Switch',
            13 => 'Xbox',
            14 => 'Windows Phone',
            default => 'Unknown'
        };
    }
}
