<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\handlers;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
use com\mochilink\connector\pmmp\protocol\UWBPMessage;
use pocketmine\console\ConsoleCommandSender;
use pocketmine\lang\Translatable;
use pocketmine\Server;
use pocketmine\utils\TextFormat;

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
                case 'server.status':
                    $this->handleGetStatus($message);
                    break;

                case 'server.getMetrics':
                    $this->handleGetMetrics($message);
                    break;
                    
                case 'server.getInfo':
                    $this->handleGetInfo($message);
                    break;
                    
                case 'server.restart':
                    $this->handleServerRestart($message);
                    break;
                    
                case 'server.stop':
                case 'server.shutdown':
                    $this->handleServerStop($message);
                    break;
                    
                case 'player.list':
                    $this->handlePlayerList($message);
                    break;
                    
                case 'player.info':
                case 'player.getInfo':
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
        $memory = $this->getMemoryInfo();
        $response = UWBPMessage::createResponse(
                $message->getId(),
            $message->getOp(),
            [
                'status' => 'online',
                'online' => true,
                'uptime' => $this->getUptimeMillis(),
                'playerCount' => count($this->server->getOnlinePlayers()),
                'maxPlayers' => $this->server->getMaxPlayers(),
                'tps' => $this->server->getTicksPerSecond(),
                'memoryUsage' => $memory
            ],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }

    /** Return the canonical performance metrics payload. */
    private function handleGetMetrics(UWBPMessage $message): void {
        $metrics = [
            'serverId' => $this->plugin->getPluginConfig()->getServerId(),
            'timestamp' => (int) (microtime(true) * 1000),
            'tps' => (float) $this->server->getTicksPerSecond(),
            'cpuUsage' => 0.0,
            'memoryUsage' => $this->getMemoryInfo(),
            'playerCount' => count($this->server->getOnlinePlayers()),
            'ping' => $this->getAveragePing()
        ];
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'server.getMetrics',
            ['metrics' => $metrics],
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
                    'status' => 'online',
                    'online' => true,
                    'maxPlayers' => $this->server->getMaxPlayers(),
                    'onlinePlayers' => count($this->server->getOnlinePlayers()),
                    'uptime' => $this->getUptimeMillis(),
                    'tps' => (float) $this->server->getTicksPerSecond(),
                    'memoryUsage' => $this->getMemoryInfo(),
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
                    'z' => $player->getPosition()->getZ(),
                    'yaw' => $player->getLocation()->getYaw(),
                    'pitch' => $player->getLocation()->getPitch()
                ],
                'ping' => max(0, (int) ($player->getNetworkSession()->getPing() ?? 0)),
                'isOp' => $player->hasPermission('pocketmine.command.op'),
                'permissions' => $this->getPermissions($player),
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
        
        $player = $this->findPlayer((string) $playerId);
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
        
        $player = $this->findPlayer((string) $playerId);
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
        
        $sender = new class($this->server, $this->server->getLanguage()) extends ConsoleCommandSender {
            private array $output = [];

            public function sendMessage(Translatable|string $message): void {
                if ($message instanceof Translatable) {
                    $message = $this->getLanguage()->translate($message);
                }
                foreach (explode("\n", trim($message)) as $line) {
                    if ($line !== '') $this->output[] = TextFormat::clean($line);
                }
            }

            public function getOutput(): array { return $this->output; }
        };
        $startTime = microtime(true);
        $success = $this->server->dispatchCommand($sender, (string) $command);
        $executionTime = (microtime(true) - $startTime) * 1000;
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            'command.execute',
            [
                'success' => $success,
                'output' => $sender->getOutput(),
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
        $players = array_map('strval', $this->server->getWhitelisted()->getAll(true));
        
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
        
        $this->server->addWhitelist((string) $playerName);
        
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
        
        $this->server->removeWhitelist((string) $playerName);
        
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
    private function sendErrorResponse(
        UWBPMessage $message,
        string $error,
        string $code = 'OPERATION_FAILED'
    ): void {
        $response = UWBPMessage::createError(
            $message->getId(),
            $message->getOp(),
            $code,
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
                'dimension' => $this->getDimensionName($world->getFolderName()),
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
        if ($limit === '' || $limit === '-1') {
            return 0;
        }
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
        
        $player = $this->findPlayer((string) $playerId);
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
            'ping' => max(0, (int) ($player->getNetworkSession()->getPing() ?? 0)),
            'isOp' => $player->hasPermission('pocketmine.command.op'),
            'permissions' => $this->getPermissions($player),
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
            $message->getOp(),
            ['player' => $playerInfo],
            true,
            null,
            $this->plugin->getPluginConfig()->getServerId()
        );
        
        $this->connectionManager->send($response);
    }

    private function findPlayer(string $identifier) {
        foreach ($this->server->getOnlinePlayers() as $onlinePlayer) {
            if ($onlinePlayer->getUniqueId()->toString() === $identifier) {
                return $onlinePlayer;
            }
        }
        return $this->server->getPlayerExact($identifier);
    }

    private function getUptimeMillis(): int {
        return max(0, (int) ((microtime(true) - $this->server->getStartTime()) * 1000));
    }

    private function getAveragePing(): int {
        $players = $this->server->getOnlinePlayers();
        if (count($players) === 0) return 0;
        $total = 0;
        foreach ($players as $player) {
            $total += (int) $player->getNetworkSession()->getPing();
        }
        return (int) ($total / count($players));
    }

    private function getPermissions($player): array {
        if (!method_exists($player, 'getEffectivePermissions')) return [];
        $permissions = [];
        foreach ($player->getEffectivePermissions() as $name => $info) {
            if (method_exists($info, 'getValue') && !$info->getValue()) continue;
            $permissions[] = method_exists($info, 'getPermission')
                ? (string) $info->getPermission()
                : (string) $name;
        }
        sort($permissions);
        return $permissions;
    }

    private function getDimensionName(string $worldName): string {
        $normalized = strtolower($worldName);
        if (str_contains($normalized, 'nether')) return 'nether';
        if (str_contains($normalized, 'end')) return 'end';
        return 'overworld';
    }

    private function getMemoryInfo(): array {
        $used = memory_get_usage(true);
        $max = $this->parseMemoryLimit((string) ini_get('memory_limit'));
        $free = $max > 0 ? max(0, $max - $used) : 0;
        return [
            'used' => $used,
            'max' => $max,
            'free' => $free,
            'percentage' => $max > 0 ? ($used / $max) * 100 : 0.0
        ];
    }
    
    /**
     * Handle server restart request
     */
    private function handleServerRestart(UWBPMessage $message): void {
        $this->sendErrorResponse(
            $message,
            'PMMP cannot restart its own process; use an external supervisor',
            'UNSUPPORTED_OPERATION'
        );
        return;
    }
    
    /**
     * Handle server stop request
     */
    private function handleServerStop(UWBPMessage $message): void {
        $data = $message->getData();
        $delay = max(0, min(3600, (int) ($data['delay'] ?? 10)));
        $responseOp = $message->getOp() === 'server.stop' ? 'server.stop' : 'server.shutdown';
        
        $response = UWBPMessage::createResponse(
            $message->getId(),
            $responseOp,
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
