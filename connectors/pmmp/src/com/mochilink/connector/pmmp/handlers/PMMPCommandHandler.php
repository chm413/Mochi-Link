<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\handlers;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
use com\mochilink\connector\pmmp\protocol\UWBPMessage;
use pocketmine\Server;

/**
 * PMMP Command Handler
 * 
 * Handles commands received from Mochi-Link management server.
 * Implements U-WBP v2 command protocol.
 * 
 * @author chm413
 * @version 1.0.0
 */
class PMMPCommandHandler {
    
    private MochiLinkPMMPPlugin $plugin;
    private PMMPConnectionManager $connectionManager;
    private Server $server;
    
    public function __construct(MochiLinkPMMPPlugin $plugin, PMMPConnectionManager $connectionManager) {
        $this->plugin = $plugin;
        $this->connectionManager = $connectionManager;
        $this->server = $plugin->getServer();
    }
    
    /**
     * Handle incoming message from management server
     */
    public function handleMessage(UWBPMessage $message): void {
        if (!$message->isRequest()) {
            return;
        }
        
        $op = $message->getOp();
        
        try {
            switch ($op) {
                case 'server.getStatus':
                    $this->handleGetStatus($message);
                    break;
                    
                case 'server.getInfo':
                    $this->handleGetInfo($message);
                    break;
                    
                case 'server.restart':
                    $this->handleServerRestart($message);
                    break;
                    
                case 'server.stop':
                    $this->handleServerStop($message);
                    break;
                    
                case 'player.list':
                    $this->handlePlayerList($message);
                    break;
                    
                case 'player.info':
                    $this->handlePlayerInfo($message);
                    break;
                    
                case 'player.kick':
                    $this->handlePlayerKick($message);
                    break;
                    
                case 'player.message':
                    $this->handlePlayerMessage($message);
                    break;
                    
                case 'command.execute':
                    $this->handleCommandExecute($message);
                    break;
                    
                case 'whitelist.get':
                    $this->handleWhitelistGet($message);
                    break;
                    
                case 'whitelist.add':
                    $this->handleWhitelistAdd($message);
                    break;
                    
                case 'whitelist.remove':
                    $this->handleWhitelistRemove($message);
                    break;
                    
                default:
                    $this->sendErrorResponse($message, "Unknown operation: {$op}");
            }
        } catch (\Exception $e) {
            $this->sendErrorResponse($message, $e->getMessage());
        }
    }
    
    /**
     * Handle server status request
     */
    private function handleGetStatus(UWBPMessage $message): void {
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'server.getStatus',
            [
                'status' => 'online',
                'uptime' => time() - $this->server->getStartTime(),
                'playerCount' => count($this->server->getOnlinePlayers()),
                'maxPlayers' => $this->server->getMaxPlayers(),
                'tps' => $this->server->getTicksPerSecond(),
                'memoryUsage' => [
                    'used' => memory_get_usage(true),
                    'max' => ini_get('memory_limit'),
                    'percentage' => (memory_get_usage(true) / $this->parseMemoryLimit(ini_get('memory_limit'))) * 100
                ]
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle server info request
     */
    private function handleGetInfo(UWBPMessage $message): void {
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'server.getInfo',
            [
                'info' => [
                    'serverId' => $this->plugin->getPluginConfig()->getServerId(),
                    'name' => $this->plugin->getPluginConfig()->getServerName(),
                    'version' => $this->server->getVersion(),
                    'coreType' => 'Bedrock',
                    'coreName' => 'PMMP',
                    'maxPlayers' => $this->server->getMaxPlayers(),
                    'onlinePlayers' => count($this->server->getOnlinePlayers()),
                    'uptime' => time() - $this->server->getStartTime(),
                    'worldInfo' => $this->getWorldInfo()
                ]
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle player list request
     */
    private function handlePlayerList(UWBPMessage $message): void {
        $players = [];
        
        foreach ($this->server->getOnlinePlayers() as $player) {
            $players[] = [
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
                'isOp' => $player->hasPermission('pocketmine.command.op'),
                'edition' => 'Bedrock'
            ];
        }
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'player.list',
            [
                'players' => $players,
                'online' => count($players),
                'max' => $this->server->getMaxPlayers()
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle player kick request
     */
    private function handlePlayerKick(UWBPMessage $message): void {
        $data = $message->getData();
        $playerId = $data['playerId'] ?? null;
        $reason = $data['reason'] ?? 'Kicked by administrator';
        
        if ($playerId === null) {
            $this->sendErrorResponse($message, 'Missing playerId parameter');
            return;
        }
        
        $player = $this->server->getPlayerByRawUUID($playerId);
        if ($player === null) {
            $this->sendErrorResponse($message, 'Player not found');
            return;
        }
        
        $player->kick($reason);
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'player.kick',
            ['success' => true, 'playerName' => $player->getName()],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle player message request
     */
    private function handlePlayerMessage(UWBPMessage $message): void {
        $data = $message->getData();
        $playerId = $data['playerId'] ?? null;
        $messageText = $data['message'] ?? null;
        
        if ($playerId === null || $messageText === null) {
            $this->sendErrorResponse($message, 'Missing required parameters');
            return;
        }
        
        $player = $this->server->getPlayerByRawUUID($playerId);
        if ($player === null) {
            $this->sendErrorResponse($message, 'Player not found');
            return;
        }
        
        $player->sendMessage($messageText);
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'player.message',
            ['success' => true],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle command execute request
     */
    private function handleCommandExecute(UWBPMessage $message): void {
        $data = $message->getData();
        $command = $data['command'] ?? null;
        
        if ($command === null) {
            $this->sendErrorResponse($message, 'Missing command parameter');
            return;
        }
        
        $startTime = microtime(true);
        $success = $this->server->dispatchCommand($this->server->getCommandSender(), $command);
        $executionTime = (microtime(true) - $startTime) * 1000;
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'command.execute',
            [
                'success' => $success,
                'output' => ['Command executed'],
                'executionTime' => $executionTime
            ],
            $success,
            $success ? null : 'Command execution failed',
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle whitelist get request
     */
    private function handleWhitelistGet(UWBPMessage $message): void {
        $whitelist = $this->server->getWhitelisted();
        $players = array_map(fn($entry) => $entry->getName(), $whitelist);
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'whitelist.get',
            [
                'enabled' => $this->server->hasWhitelist(),
                'players' => $players
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle whitelist add request
     */
    private function handleWhitelistAdd(UWBPMessage $message): void {
        $data = $message->getData();
        $playerName = $data['playerName'] ?? null;
        
        if ($playerName === null) {
            $this->sendErrorResponse($message, 'Missing playerName parameter');
            return;
        }
        
        $this->server->getWhitelisted()->add($playerName);
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'whitelist.add',
            ['success' => true, 'playerName' => $playerName],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle whitelist remove request
     */
    private function handleWhitelistRemove(UWBPMessage $message): void {
        $data = $message->getData();
        $playerName = $data['playerName'] ?? null;
        
        if ($playerName === null) {
            $this->sendErrorResponse($message, 'Missing playerName parameter');
            return;
        }
        
        $this->server->getWhitelisted()->remove($playerName);
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'whitelist.remove',
            ['success' => true, 'playerName' => $playerName],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Send error response
     */
    private function sendErrorResponse(UWBPMessage $message, string $error): void {
        $response = UWBPMessage::createResponse(
            $message->getId(),
            $message->getOp(),
            [],
            false,
            $error,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Get world information
     */
    private function getWorldInfo(): array {
        $worlds = [];
        
        foreach ($this->server->getWorldManager()->getWorlds() as $world) {
            $worlds[] = [
                'name' => $world->getFolderName(),
                'dimension' => $world->getProvider()->getWorldData()->getName(),
                'playerCount' => count($world->getPlayers()),
                'loadedChunks' => count($world->getLoadedChunks())
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
     * Handle player info request
     */
    private function handlePlayerInfo(UWBPMessage $message): void {
        $data = $message->getData();
        $playerId = $data['playerId'] ?? null;
        
        if ($playerId === null) {
            $this->sendErrorResponse($message, 'Missing playerId parameter');
            return;
        }
        
        $player = $this->server->getPlayerByRawUUID($playerId);
        if ($player === null) {
            $this->sendErrorResponse($message, 'Player not found');
            return;
        }
        
        $playerInfo = [
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
            'isOp' => $player->hasPermission('pocketmine.command.op'),
            'health' => $player->getHealth(),
            'maxHealth' => $player->getMaxHealth(),
            'foodLevel' => $player->getHungerManager()->getFood(),
            'xpLevel' => $player->getXpManager()->getXpLevel(),
            'xpProgress' => $player->getXpManager()->getXpProgress(),
            'gameMode' => $player->getGamemode()->name(),
            'isFlying' => $player->isFlying(),
            'isSneaking' => $player->isSneaking(),
            'isSprinting' => $player->isSprinting(),
            'address' => $player->getNetworkSession()->getIp(),
            'edition' => 'Bedrock',
            'deviceOS' => $player->getPlayerInfo()->getExtraData()['DeviceOS'] ?? 'Unknown'
        ];
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'player.info',
            ['player' => $playerInfo],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }
    
    /**
     * Handle server restart request
     */
    private function handleServerRestart(UWBPMessage $message): void {
        $data = $message->getData();
        $delay = $data['delay'] ?? 10;
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'server.restart',
            [
                'success' => true,
                'delay' => $delay,
                'message' => "Server will restart in {$delay} seconds"
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
        
        // Broadcast to all players
        $broadcastMessage = "§c[Mochi-Link] Server will restart in {$delay} seconds!";
        $this->server->broadcastMessage($broadcastMessage);
        
        // Schedule restart
        $this->plugin->getScheduler()->scheduleDelayedTask(
            new class($this->server) extends \pocketmine\scheduler\Task {
                private $server;
                
                public function __construct($server) {
                    $this->server = $server;
                }
                
                public function onRun(): void {
                    $this->server->shutdown();
                }
            },
            $delay * 20
        );
    }
    
    /**
     * Handle server stop request
     */
    private function handleServerStop(UWBPMessage $message): void {
        $data = $message->getData();
        $delay = $data['delay'] ?? 10;
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'server.stop',
            [
                'success' => true,
                'delay' => $delay,
                'message' => "Server will stop in {$delay} seconds"
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
        
        // Broadcast to all players
        $broadcastMessage = "§c[Mochi-Link] Server will stop in {$delay} seconds!";
        $this->server->broadcastMessage($broadcastMessage);
        
        // Schedule stop
        $this->plugin->getScheduler()->scheduleDelayedTask(
            new class($this->server) extends \pocketmine\scheduler\Task {
                private $server;
                
                public function __construct($server) {
                    $this->server = $server;
                }
                
                public function onRun(): void {
                    $this->server->shutdown();
                }
            },
            $delay * 20
        );
    }
}
