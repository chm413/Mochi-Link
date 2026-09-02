<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\connection;

use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
use com\mochilink\connector\pmmp\config\PMMPPluginConfig;
use com\mochilink\connector\pmmp\protocol\UWBPMessage;
use com\mochilink\connector\common\ReconnectionManager;
use com\mochilink\connector\common\ReconnectionConfig;
use com\mochilink\connector\common\ReconnectionCallback;
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
 * @version 2.1.0
 */
class PMMPConnectionManager implements ReconnectionCallback {
    private const DECLARED_CAPABILITIES = [
        'player_management',
        'command_execution',
        'performance_monitoring',
        'event_streaming',
        'whitelist_management',
        'server_control'
    ];
    
    private MochiLinkPMMPPlugin $plugin;
    private PMMPPluginConfig $config;
    
    private bool $connected = false;
    private bool $connecting = false;
    
    private ReconnectionManager $reconnectionManager;
    
    /** @var resource|null */
    private $socket = null;
    private string $receiveBuffer = '';
    private string $fragmentBuffer = '';
    private ?int $fragmentOpcode = null;
    
    private array $messageQueue = [];
    private array $pendingMessages = [];
    
    public function __construct(MochiLinkPMMPPlugin $plugin, PMMPPluginConfig $config) {
        $this->plugin = $plugin;
        $this->config = $config;
        
        // 初始化重连管理器
        $reconnectionConfig = new ReconnectionConfig(
            $config->getRetryDelay(),
            $config->getRetryAttempts(),
            1.5,
            60000,
            true
        );
        
        $this->reconnectionManager = new ReconnectionManager(
            $plugin,
            $reconnectionConfig,
            $this
        );
    }
    
    // ReconnectionCallback 接口实现
    public function attemptReconnect(): bool {
        $this->connect();
        return $this->connected;
    }
    
    public function onReconnecting(int $attempts, int $nextInterval): void {
        $this->plugin->getLogger()->info("第 {$attempts} 次重连，{$nextInterval}ms 后执行");
    }
    
    public function onMaxAttemptsReached(int $totalAttempts): void {
        $this->plugin->getLogger()->warning("达到最大重连次数，总尝试: {$totalAttempts}");
    }
    
    public function onReconnectionDisabled(int $totalAttempts): void {
        $this->plugin->getLogger()->warning("重连已禁用，总尝试: {$totalAttempts}");
    }
    
    public function onReconnectionEnabled(): void {
        $this->plugin->getLogger()->info('重连已重新启用');
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
            
            // Use TLS for WSS deployments. The HTTP upgrade remains the same
            // after the encrypted stream is established.
            $scheme = $this->config->useSsl() ? 'tls' : 'tcp';
            $address = "{$scheme}://{$host}:{$port}";
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
            
            // 重置重连状态
            $this->reconnectionManager->reset();
            
            $this->plugin->getLogger()->info(TextFormat::GREEN . "Connected to Mochi-Link management server!");
            
            // URL/header token authentication is complete before application
            // messages are exchanged. A token-less connection answers the
            // server challenge from handleSystemMessage().
            
            // Send queued messages
            $this->sendQueuedMessages();
            
        } catch (\Exception $e) {
            $this->connecting = false;
            $this->plugin->getLogger()->error("Failed to connect: " . $e->getMessage());
            
            // Schedule reconnection on connection failure
            if ($this->config->isAutoReconnectEnabled()) {
                $this->reconnectionManager->scheduleReconnect();
            }
        }
    }
    
    /**
     * Disconnect from Mochi-Link
     */
    public function disconnect(): void {
        if (!$this->connected && !$this->connecting && $this->socket === null) {
            return;
        }
        
        $this->plugin->getLogger()->info("Disconnecting from Mochi-Link...");
        
        // 取消重连
        $this->reconnectionManager->cancel();
        
        if ($this->connected) {
            $this->sendDisconnect("Plugin disabled");
        }
        
        // Close socket
        if ($this->socket !== null) {
            @fclose($this->socket);
            $this->socket = null;
        }
        
        $this->connected = false;
        $this->connecting = false;
        $this->receiveBuffer = '';
        $this->fragmentBuffer = '';
        $this->fragmentOpcode = null;
        $this->pendingMessages = [];
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
            
            $remaining = strlen($frame);
            $offset = 0;
            while ($remaining > 0) {
                $written = @fwrite($this->socket, substr($frame, $offset));
                if ($written === false || $written === 0) {
                    throw new \RuntimeException("Failed to send message");
                }
                $offset += $written;
                $remaining -= $written;
            }
            
            // Track pending messages
            if ($message->isRequest()) {
                $this->pendingMessages[$message->getId()] = [
                    'message' => $message,
                    'timestamp' => (int) (microtime(true) * 1000)
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
        
        $query = 'serverId=' . rawurlencode($serverId);
        $token = $this->config->getAuthToken();
        $request = "GET {$path}?{$query} HTTP/1.1\r\n";
        $request .= "Host: {$host}:{$port}\r\n";
        $request .= "Upgrade: websocket\r\n";
        $request .= "Connection: Upgrade\r\n";
        $request .= "Sec-WebSocket-Key: {$key}\r\n";
        $request .= "Sec-WebSocket-Version: 13\r\n";
        $request .= "X-Server-Id: {$serverId}\r\n";
        $request .= "X-Server-Type: PMMP\r\n";
        $request .= "X-Protocol-Version: 2.0\r\n";
        $request .= "X-Capabilities: " . implode(',', self::DECLARED_CAPABILITIES) . "\r\n";
        if ($token !== '') {
            $request .= "X-Auth-Token: {$token}\r\n";
        }
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

        $expectedAccept = base64_encode(sha1(
            $key . '258EAFA5-E914-47DA-95CA-C5AB0DC85B11',
            true
        ));
        if (!preg_match('/^Sec-WebSocket-Accept:\s*(.+)$/mi', $response, $matches) ||
            !hash_equals($expectedAccept, trim($matches[1]))) {
            throw new \RuntimeException("Invalid WebSocket handshake response");
        }
    }
    
    /**
     * Send handshake message (U-WBP v2)
     */
    private function sendHandshake(?array $challengeMessage = null): void {
        $token = $this->config->getAuthToken();
        $challenge = isset($challengeMessage['data']['challenge'])
            ? (string) $challengeMessage['data']['challenge']
            : null;
        $challengeTimestamp = $challenge !== null
            ? (int) ($challengeMessage['data']['challengeTimestamp'] ?? $challengeMessage['timestamp'] ?? 0)
            : null;
        $data = [
            'serverId' => $this->config->getServerId(),
            'serverName' => $this->config->getServerName(),
            'serverType' => 'PMMP',
            'protocolVersion' => '2.0',
            // Shutdown is supported; restart is explicitly rejected by
            // PMMPCommandHandler because PMMP cannot spawn its process.
            'capabilities' => self::DECLARED_CAPABILITIES,
            'authentication' => [
                'token' => $token,
                'method' => $challenge !== null ? 'challenge' : 'token'
            ]
        ];
        if ($challenge !== null && $challengeTimestamp !== null) {
            $data['challenge'] = $challenge;
            $data['challengeTimestamp'] = $challengeTimestamp;
            $data['challengeResponse'] = hash_hmac(
                'sha256',
                "{$challenge}:{$token}:{$challengeTimestamp}",
                $token
            );
        }

        $message = UWBPMessage::createSystem(
            'handshake',
            $data,
            $this->config->getServerId(),
            isset($challengeMessage['id']) ? (string) $challengeMessage['id'] : null
        );
        
        $this->send($message);
    }
    
    /**
     * Send disconnect message
     */
    private function sendDisconnect(string $reason): void {
        $message = UWBPMessage::createSystem(
            'disconnect',
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
        
        $message = UWBPMessage::createSystem(
            'ping',
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
     * Get reconnection status
     */
    public function getReconnectionStatus() {
        return $this->reconnectionManager->getStatus();
    }
    
    /**
     * Enable reconnection
     */
    public function enableReconnection(): void {
        $this->reconnectionManager->enable();
    }
    
    /**
     * Disable reconnection
     */
    public function disableReconnection(): void {
        $this->reconnectionManager->disable();
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
            // RFC 6455 encodes the 64-bit length in network byte order.
            $high = intdiv($length, 4294967296);
            $low = $length % 4294967296;
            $frame .= pack('NN', $high, $low);
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
            do {
                $data = @fread($this->socket, 8192);
                if ($data === false) {
                    throw new \RuntimeException('Failed to read from WebSocket');
                }
                if ($data !== '') {
                    $this->receiveBuffer .= $data;
                }
            } while ($data !== '' && !feof($this->socket));

            if (feof($this->socket)) {
                $this->markSocketDisconnected('WebSocket stream closed');
                return;
            }

            while (true) {
                $frame = $this->extractWebSocketFrame();
                if ($frame === null) break;
                $opcode = $frame['opcode'];
                if ($opcode === 0x8) {
                    $this->markSocketDisconnected('Peer closed WebSocket');
                    return;
                }
                if ($opcode === 0x9) {
                    $this->sendControlFrame(0xA, $frame['payload']);
                    continue;
                }
                if ($opcode === 0xA) continue;

                if ($opcode === 0x0) {
                    if ($this->fragmentOpcode === null) continue;
                    $this->fragmentBuffer .= $frame['payload'];
                    if ($frame['fin']) {
                        $this->handleMessage($this->fragmentBuffer);
                        $this->fragmentBuffer = '';
                        $this->fragmentOpcode = null;
                    }
                } elseif (!$frame['fin']) {
                    $this->fragmentOpcode = $opcode;
                    $this->fragmentBuffer = $frame['payload'];
                } else {
                    $this->handleMessage($frame['payload']);
                }
            }
            
        } catch (\Exception $e) {
            $this->plugin->getLogger()->error("Error reading messages: " . $e->getMessage());
            $this->markSocketDisconnected($e->getMessage());
        }
    }
    
    /**
     * Parse WebSocket frame (simplified)
     */
    private function parseWebSocketFrame(string $data): ?string {
        $buffer = $data;
        $frame = $this->extractWebSocketFrameFrom($buffer);
        return $frame === null ? null : $frame['payload'];
    }

    /** Extract one complete RFC 6455 frame and consume it from the buffer. */
    private function extractWebSocketFrame(): ?array {
        return $this->extractWebSocketFrameFrom($this->receiveBuffer);
    }

    private function extractWebSocketFrameFrom(string &$buffer): ?array {
        $length = strlen($buffer);
        if ($length < 2) return null;

        $first = ord($buffer[0]);
        $second = ord($buffer[1]);
        $fin = ($first & 0x80) !== 0;
        $opcode = $first & 0x0F;
        $masked = ($second & 0x80) !== 0;
        $payloadLength = $second & 0x7F;
        $offset = 2;

        if ($payloadLength === 126) {
            if ($length < $offset + 2) return null;
            $payloadLength = unpack('n', substr($buffer, $offset, 2))[1];
            $offset += 2;
        } elseif ($payloadLength === 127) {
            if ($length < $offset + 8) return null;
            $parts = unpack('N2', substr($buffer, $offset, 8));
            if ($parts[1] !== 0) {
                throw new \RuntimeException('WebSocket frame is too large');
            }
            $payloadLength = $parts[2];
            $offset += 8;
        }

        $mask = '';
        if ($masked) {
            if ($length < $offset + 4) return null;
            $mask = substr($buffer, $offset, 4);
            $offset += 4;
        }

        if ($payloadLength > 1024 * 1024) {
            throw new \RuntimeException('WebSocket frame exceeds 1 MiB limit');
        }
        if ($length < $offset + $payloadLength) return null;

        $payload = substr($buffer, $offset, $payloadLength);
        $buffer = substr($buffer, $offset + $payloadLength);
        if ($masked) {
            for ($i = 0; $i < $payloadLength; $i++) {
                $payload[$i] = $payload[$i] ^ $mask[$i % 4];
            }
        }

        return ['fin' => $fin, 'opcode' => $opcode, 'payload' => $payload];
    }

    private function sendControlFrame(int $opcode, string $payload): void {
        if ($this->socket === null || !$this->connected) return;
        $this->sendRawFrame($opcode, $payload);
    }

    private function sendRawFrame(int $opcode, string $payload): void {
        $length = strlen($payload);
        if ($length > 125) throw new \RuntimeException('Control frame payload too large');
        // Client-to-server frames must be masked.
        $mask = random_bytes(4);
        $frame = chr(0x80 | ($opcode & 0x0F)) . chr(0x80 | $length) . $mask;
        for ($i = 0; $i < $length; $i++) {
            $frame .= $payload[$i] ^ $mask[$i % 4];
        }
        $offset = 0;
        while ($offset < strlen($frame)) {
            $written = @fwrite($this->socket, substr($frame, $offset));
            if ($written === false || $written === 0) throw new \RuntimeException('Failed to send control frame');
            $offset += $written;
        }
    }

    private function markSocketDisconnected(string $reason): void {
        if (!$this->connected && $this->socket === null) return;
        if ($this->socket !== null) @fclose($this->socket);
        $this->socket = null;
        $wasConnected = $this->connected;
        $this->connected = false;
        $this->connecting = false;
        $this->receiveBuffer = '';
        $this->fragmentBuffer = '';
        $this->fragmentOpcode = null;
        if ($wasConnected) {
            $this->plugin->setConnected(false);
            $this->plugin->getLogger()->warning("Mochi-Link connection lost: {$reason}");
            if ($this->config->isAutoReconnectEnabled()) {
                $this->reconnectionManager->scheduleReconnect();
            }
        }
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
                // All server/player/command operations are owned by the
                // command handler. Keep subscription handling local because
                // it updates the PMMP subscription manager directly.
                $message = UWBPMessage::fromJson(json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                if ($message !== null && $this->plugin->getCommandHandler() !== null) {
                    $this->plugin->getCommandHandler()->handleMessage($message);
                } else {
                    $this->sendErrorResponse($requestId, $op, "Unsupported operation: {$op}");
                }
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
                true,
                null,
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
                true,
                null,
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
        $id = $response['requestId'] ?? $response['id'] ?? '';
        
        if (isset($this->pendingMessages[$id])) {
            unset($this->pendingMessages[$id]);
        }
    }
    
    /**
     * Handle system message
     */
    private function handleSystemMessage(array $message): void {
        $op = $message['systemOp'] ?? $message['op'] ?? '';
        
        switch ($op) {
            case 'pong':
                // Heartbeat response received
                break;
            case 'ping':
                $this->send(UWBPMessage::createSystem(
                    'pong',
                    [
                        'serverId' => $this->config->getServerId(),
                        'timestamp' => (int) (microtime(true) * 1000)
                    ],
                    $this->config->getServerId(),
                    isset($message['id']) ? (string) $message['id'] : null
                ));
                break;
            case 'handshake':
                if ($this->config->getAuthToken() !== '') {
                    $this->sendHandshake($message);
                }
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
        $reconnectionStatus = $this->reconnectionManager->getStatus();
        return [
            'connected' => $this->connected,
            'connecting' => $this->connecting,
            'reconnectAttempts' => $reconnectionStatus->currentAttempts,
            'totalReconnectAttempts' => $reconnectionStatus->totalAttempts,
            'reconnectionDisabled' => $reconnectionStatus->disabled,
            'queuedMessages' => count($this->messageQueue),
            'pendingMessages' => count($this->pendingMessages)
        ];
    }
}
