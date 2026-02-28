<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\connection;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\config\PMMPPluginConfig;
use com\mochilink\connector\pmmp\protocol\UWBPMessage;
use pocketmine\utils\TextFormat;

/**
 * PMMP Connection Manager
 * 
 * Manages WebSocket connection to Mochi-Link management server.
 * Implements U-WBP v2 protocol.
 * 
 * Note: PMMP doesn't have built-in WebSocket client support.
 * This implementation uses a simple socket-based approach.
 * For production, consider using a proper WebSocket library via Composer.
 * 
 * @author chm413
 * @version 1.0.0
 */
class PMMPConnectionManager {
    
    private MochiLinkPMMPPlugin $plugin;
    private PMMPPluginConfig $config;
    
    private bool $connected = false;
    private bool $connecting = false;
    private int $reconnectAttempts = 0;
    
    /** @var resource|null */
    private $socket = null;
    
    private array $messageQueue = [];
    private array $pendingMessages = [];
    
    public function __construct(MochiLinkPMMPPlugin $plugin, PMMPPluginConfig $config) {
        $this->plugin = $plugin;
        $this->config = $config;
    }
    
    /**
     * Connect to Mochi-Link management server
     */
    public function connect(): void {
        if ($this->connected || $this->connecting) {
            return;
        }
        
        $this->connecting = true;
        
        try {
            $host = $this->config->getMochiLinkHost();
            $port = $this->config->getMochiLinkPort();
            $serverId = $this->config->getServerId();
            
            $this->plugin->getLogger()->info(TextFormat::YELLOW . "Connecting to Mochi-Link at {$host}:{$port}...");
            
            // Create socket connection
            $address = "tcp://{$host}:{$port}";
            $this->socket = @stream_socket_client(
                $address,
                $errno,
                $errstr,
                $this->config->getTimeout() / 1000
            );
            
            if ($this->socket === false) {
                throw new \RuntimeException("Failed to connect: {$errstr} ({$errno})");
            }
            
            // Set non-blocking mode
            stream_set_blocking($this->socket, false);
            
            // Perform WebSocket handshake
            $this->performWebSocketHandshake();
            
            $this->connected = true;
            $this->connecting = false;
            $this->reconnectAttempts = 0;
            
            $this->plugin->getLogger()->info(TextFormat::GREEN . "Connected to Mochi-Link management server!");
            
            // Send handshake message
            $this->sendHandshake();
            
            // Send queued messages
            $this->sendQueuedMessages();
            
        } catch (\Exception $e) {
            $this->connecting = false;
            $this->plugin->getLogger()->error("Failed to connect: " . $e->getMessage());
            
            // Schedule reconnection
            if ($this->config->isAutoReconnectEnabled() && 
                $this->reconnectAttempts < $this->config->getRetryAttempts()) {
                $this->scheduleReconnect();
            }
        }
    }
    
    /**
     * Disconnect from Mochi-Link
     */
    public function disconnect(): void {
        if (!$this->connected) {
            return;
        }
        
        $this->plugin->getLogger()->info("Disconnecting from Mochi-Link...");
        
        // Send disconnect message
        $this->sendDisconnect("Plugin disabled");
        
        // Close socket
        if ($this->socket !== null) {
            @fclose($this->socket);
            $this->socket = null;
        }
        
        $this->connected = false;
        $this->connecting = false;
        $this->reconnectAttempts = 0;
    }
    
    /**
     * Send message to Mochi-Link
     */
    public function send(UWBPMessage $message): void {
        if (!$this->connected || $this->socket === null) {
            // Queue message for later
            $this->messageQueue[] = $message;
            return;
        }
        
        try {
            $json = $message->toJson();
            $frame = $this->createWebSocketFrame($json);
            
            $written = @fwrite($this->socket, $frame);
            if ($written === false) {
                throw new \RuntimeException("Failed to send message");
            }
            
            // Track pending messages
            if ($message->isRequest()) {
                $this->pendingMessages[$message->getId()] = [
                    'message' => $message,
                    'timestamp' => time()
                ];
            }
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->error("Failed to send message: " . $e->getMessage());
            $this->messageQueue[] = $message;
        }
    }
    
    /**
     * Perform WebSocket handshake
     */
    private function performWebSocketHandshake(): void {
        $host = $this->config->getMochiLinkHost();
        $port = $this->config->getMochiLinkPort();
        $path = $this->config->getMochiLinkPath();
        $serverId = $this->config->getServerId();
        
        $key = base64_encode(random_bytes(16));
        
        $request = "GET {$path}?serverId=" . urlencode($serverId) . " HTTP/1.1\r\n";
        $request .= "Host: {$host}:{$port}\r\n";
        $request .= "Upgrade: websocket\r\n";
        $request .= "Connection: Upgrade\r\n";
        $request .= "Sec-WebSocket-Key: {$key}\r\n";
        $request .= "Sec-WebSocket-Version: 13\r\n";
        $request .= "X-Server-Id: {$serverId}\r\n";
        $request .= "X-Server-Type: PMMP\r\n";
        $request .= "X-Protocol-Version: 2.0\r\n";
        $request .= "Authorization: Bearer " . $this->config->getAuthToken() . "\r\n";
        $request .= "\r\n";
        
        fwrite($this->socket, $request);
        
        // Read response
        $response = '';
        $timeout = time() + 5;
        while (time() < $timeout) {
            $line = fgets($this->socket);
            if ($line === false) {
                usleep(10000);
                continue;
            }
            $response .= $line;
            if (strpos($response, "\r\n\r\n") !== false) {
                break;
            }
        }
        
        if (strpos($response, '101 Switching Protocols') === false) {
            throw new \RuntimeException("WebSocket handshake failed");
        }
    }
    
    /**
     * Send handshake message (U-WBP v2)
     */
    private function sendHandshake(): void {
        $message = UWBPMessage::createRequest(
            'system.handshake',
            [
                'serverId' => $this->config->getServerId(),
                'serverName' => $this->config->getServerName(),
                'serverType' => 'PMMP',
                'protocolVersion' => '2.0',
                'capabilities' => [
                    'player_management',
                    'command_execution',
                    'performance_monitoring',
                    'event_streaming',
                    'whitelist_management'
                ],
                'authentication' => [
                    'token' => $this->config->getAuthToken()
                ]
            ],
            $this->config->getServerId()
        );
        
        $this->send($message);
    }
    
    /**
     * Send disconnect message
     */
    private function sendDisconnect(string $reason): void {
        $message = UWBPMessage::createRequest(
            'system.disconnect',
            ['reason' => $reason],
            $this->config->getServerId()
        );
        
        $this->send($message);
    }
    
    /**
     * Send heartbeat (ping) message
     */
    public function sendHeartbeat(): void {
        if (!$this->connected) {
            return;
        }
        
        $message = UWBPMessage::createRequest(
            'system.ping',
            [
                'serverId' => $this->config->getServerId(),
                'timestamp' => (int)(microtime(true) * 1000)
            ],
            $this->config->getServerId()
        );
        
        $this->send($message);
    }
    
    /**
     * Send event message
     */
    public function sendEvent(string $eventOp, array $eventData): void {
        $message = UWBPMessage::createEvent(
            $eventOp,
            $eventData,
            $this->config->getServerId()
        );
        
        $this->send($message);
    }
    
    /**
     * Send queued messages
     */
    private function sendQueuedMessages(): void {
        if (empty($this->messageQueue)) {
            return;
        }
        
        $this->plugin->getLogger()->info("Sending " . count($this->messageQueue) . " queued messages");
        
        $messages = $this->messageQueue;
        $this->messageQueue = [];
        
        foreach ($messages as $message) {
            $this->send($message);
        }
    }
    
    /**
     * Schedule reconnection attempt
     */
    private function scheduleReconnect(): void {
        $this->reconnectAttempts++;
        $delay = $this->config->getRetryDelay() * pow(2, $this->reconnectAttempts - 1) / 1000;
        
        $this->plugin->getLogger()->info(
            "Scheduling reconnection attempt {$this->reconnectAttempts}/" . 
            $this->config->getRetryAttempts() . " in {$delay} seconds"
        );
        
        $this->plugin->getScheduler()->scheduleDelayedTask(
            new \pocketmine\scheduler\ClosureTask(function(): void {
                $this->connect();
            }),
            (int)($delay * 20) // Convert seconds to ticks
        );
    }
    
    /**
     * Create WebSocket frame
     */
    private function createWebSocketFrame(string $data): string {
        $length = strlen($data);
        $frame = chr(0x81); // Text frame, FIN bit set
        
        if ($length <= 125) {
            $frame .= chr($length | 0x80); // Mask bit set
        } elseif ($length <= 65535) {
            $frame .= chr(126 | 0x80);
            $frame .= pack('n', $length);
        } else {
            $frame .= chr(127 | 0x80);
            $frame .= pack('J', $length);
        }
        
        // Masking key
        $mask = random_bytes(4);
        $frame .= $mask;
        
        // Masked data
        for ($i = 0; $i < $length; $i++) {
            $frame .= $data[$i] ^ $mask[$i % 4];
        }
        
        return $frame;
    }
    
    /**
     * Read incoming messages (should be called periodically)
     */
    public function tick(): void {
        if (!$this->connected || $this->socket === null) {
            return;
        }
        
        try {
            $data = @fread($this->socket, 8192);
            if ($data === false || $data === '') {
                return;
            }
            
            // Parse WebSocket frame and handle message
            $message = $this->parseWebSocketFrame($data);
            if ($message !== null) {
                $this->handleMessage($message);
            }
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->error("Error reading messages: " . $e->getMessage());
        }
    }
    
    /**
     * Parse WebSocket frame (simplified)
     */
    private function parseWebSocketFrame(string $data): ?string {
        // Simplified WebSocket frame parsing
        // For production, use a proper WebSocket library
        if (strlen($data) < 2) {
            return null;
        }
        
        $payloadLength = ord($data[1]) & 0x7F;
        $offset = 2;
        
        if ($payloadLength === 126) {
            $offset = 4;
        } elseif ($payloadLength === 127) {
            $offset = 10;
        }
        
        return substr($data, $offset);
    }
    
    /**
     * Handle incoming message
     */
    private function handleMessage(string $message): void {
        try {
            $data = json_decode($message, true);
            if ($data === null) {
                return;
            }
            
            $type = $data['type'] ?? '';
            
            if ($type === 'request') {
                $this->handleRequest($data);
            } elseif ($type === 'response') {
                $this->handleResponse($data);
            } elseif ($type === 'system') {
                $this->handleSystemMessage($data);
            }
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->error("Failed to handle message: " . $e->getMessage());
        }
    }
    
    /**
     * Handle request message
     */
    private function handleRequest(array $request): void {
        $op = $request['op'] ?? '';
        $requestId = $request['id'] ?? '';
        
        switch ($op) {
            case 'event.subscribe':
                $this->handleEventSubscribe($request, $requestId);
                break;
            case 'event.unsubscribe':
                $this->handleEventUnsubscribe($request, $requestId);
                break;
            default:
                $this->plugin->getLogger()->debug("Unhandled request operation: {$op}");
                break;
        }
    }
    
    /**
     * Handle event subscription request
     */
    private function handleEventSubscribe(array $request, string $requestId): void {
        try {
            $data = $request['data'] ?? [];
            
            // Generate subscription ID
            $subscriptionId = 'sub_' . time() . '_' . bin2hex(random_bytes(4));
            
            // Extract event types
            $eventTypes = $data['eventTypes'] ?? [];
            
            // Extract filters
            $filters = $data['filters'] ?? [];
            
            // Create subscription
            $subscription = new \com\mochilink\connector\pmmp\subscription\EventSubscription(
                $subscriptionId,
                $eventTypes,
                $filters,
                time()
            );
            
            // Add to subscription manager
            $this->plugin->getSubscriptionManager()->addSubscription($subscriptionId, $subscription);
            
            // Send success response
            $response = UWBPMessage::createResponse(
                $requestId,
                'event.subscribe',
                [
                    'subscriptionId' => $subscriptionId,
                    'success' => true
                ],
                $this->config->getServerId()
            );
            
            $this->send($response);
            $this->plugin->getLogger()->info("Event subscription created: {$subscriptionId}");
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->warning("Failed to handle event subscription: " . $e->getMessage());
            $this->sendErrorResponse($requestId, 'event.subscribe', $e->getMessage());
        }
    }
    
    /**
     * Handle event unsubscription request
     */
    private function handleEventUnsubscribe(array $request, string $requestId): void {
        try {
            $data = $request['data'] ?? [];
            $subscriptionId = $data['subscriptionId'] ?? '';
            
            if (empty($subscriptionId)) {
                throw new \InvalidArgumentException('Missing subscriptionId');
            }
            
            // Remove subscription
            $this->plugin->getSubscriptionManager()->removeSubscription($subscriptionId);
            
            // Send success response
            $response = UWBPMessage::createResponse(
                $requestId,
                'event.unsubscribe',
                ['success' => true],
                $this->config->getServerId()
            );
            
            $this->send($response);
            $this->plugin->getLogger()->info("Event subscription removed: {$subscriptionId}");
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->warning("Failed to handle event unsubscription: " . $e->getMessage());
            $this->sendErrorResponse($requestId, 'event.unsubscribe', $e->getMessage());
        }
    }
    
    /**
     * Handle response message
     */
    private function handleResponse(array $response): void {
        $id = $response['id'] ?? '';
        
        if (isset($this->pendingMessages[$id])) {
            unset($this->pendingMessages[$id]);
        }
    }
    
    /**
     * Handle system message
     */
    private function handleSystemMessage(array $message): void {
        $op = $message['op'] ?? '';
        
        switch ($op) {
            case 'pong':
                // Heartbeat response received
                break;
            default:
                $this->plugin->getLogger()->debug("Received system message: {$op}");
                break;
        }
    }
    
    /**
     * Send error response
     */
    private function sendErrorResponse(string $requestId, string $op, string $errorMessage): void {
        $response = UWBPMessage::createError(
            $requestId,
            $op,
            'OPERATION_FAILED',
            $errorMessage,
            $this->config->getServerId()
        );
        
        $this->send($response);
    }
    
    // Status methods
    public function isConnected(): bool { return $this->connected; }
    public function isConnecting(): bool { return $this->connecting; }
    
    public function getConnectionStatus(): string {
        if ($this->connected) {
            return 'connected';
        } elseif ($this->connecting) {
            return 'connecting';
        } else {
            return 'disconnected';
        }
    }
    
    public function getConnectionStats(): array {
        return [
            'connected' => $this->connected,
            'connecting' => $this->connecting,
            'reconnectAttempts' => $this->reconnectAttempts,
            'queuedMessages' => count($this->messageQueue),
            'pendingMessages' => count($this->pendingMessages)
        ];
    }
}
