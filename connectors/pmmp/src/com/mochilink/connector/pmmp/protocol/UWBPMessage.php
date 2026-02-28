<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\protocol;

/**
 * U-WBP v2 Protocol Message
 * 
 * Unified WebSocket Bridge Protocol version 2.0 message implementation.
 * 
 * @author chm413
 * @version 1.0.0
 */
class UWBPMessage {
    
    public const VERSION = '2.0';
    public const PROTOCOL_NAME = 'U-WBP';
    
    // Message types
    public const TYPE_REQUEST = 'request';
    public const TYPE_RESPONSE = 'response';
    public const TYPE_EVENT = 'event';
    
    private string $type;
    private string $id;
    private string $op;
    private array $data;
    private int $timestamp;
    private string $version;
    private ?string $serverId;
    
    public function __construct(
        string $type,
        string $op,
        array $data = [],
        ?string $serverId = null
    ) {
        $this->type = $type;
        $this->id = $this->generateId();
        $this->op = $op;
        $this->data = $data;
        $this->timestamp = (int)(microtime(true) * 1000);
        $this->version = self::VERSION;
        $this->serverId = $serverId;
    }
    
    /**
     * Create a request message
     */
    public static function createRequest(string $op, array $data = [], ?string $serverId = null): self {
        return new self(self::TYPE_REQUEST, $op, $data, $serverId);
    }
    
    /**
     * Create a response message
     */
    public static function createResponse(
        string $requestId,
        string $op,
        array $data = [],
        bool $success = true,
        ?string $error = null,
        ?string $serverId = null
    ): self {
        $message = new self(self::TYPE_RESPONSE, $op, $data, $serverId);
        $message->data['success'] = $success;
        if ($error !== null) {
            $message->data['error'] = $error;
        }
        $message->data['requestId'] = $requestId;
        return $message;
    }
    
    /**
     * Create an event message
     */
    public static function createEvent(string $op, array $data = [], ?string $serverId = null): self {
        return new self(self::TYPE_EVENT, $op, $data, $serverId);
    }
    
    /**
     * Parse message from JSON string
     */
    public static function fromJson(string $json): ?self {
        $decoded = json_decode($json, true);
        if ($decoded === null || !is_array($decoded)) {
            return null;
        }
        
        if (!isset($decoded['type'], $decoded['id'], $decoded['op'])) {
            return null;
        }
        
        $message = new self(
            $decoded['type'],
            $decoded['op'],
            $decoded['data'] ?? [],
            $decoded['serverId'] ?? null
        );
        
        $message->id = $decoded['id'];
        $message->timestamp = $decoded['timestamp'] ?? (int)(microtime(true) * 1000);
        $message->version = $decoded['version'] ?? self::VERSION;
        
        return $message;
    }
    
    /**
     * Convert message to JSON string
     */
    public function toJson(): string {
        $data = [
            'type' => $this->type,
            'id' => $this->id,
            'op' => $this->op,
            'data' => $this->data,
            'timestamp' => $this->timestamp,
            'version' => $this->version
        ];
        
        if ($this->serverId !== null) {
            $data['serverId'] = $this->serverId;
        }
        
        return json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    
    /**
     * Convert message to array
     */
    public function toArray(): array {
        $data = [
            'type' => $this->type,
            'id' => $this->id,
            'op' => $this->op,
            'data' => $this->data,
            'timestamp' => $this->timestamp,
            'version' => $this->version
        ];
        
        if ($this->serverId !== null) {
            $data['serverId'] = $this->serverId;
        }
        
        return $data;
    }
    
    /**
     * Generate unique message ID
     */
    private function generateId(): string {
        return sprintf('%d-%s', (int)(microtime(true) * 1000), bin2hex(random_bytes(4)));
    }
    
    // Getters
    public function getType(): string { return $this->type; }
    public function getId(): string { return $this->id; }
    public function getOp(): string { return $this->op; }
    public function getData(): array { return $this->data; }
    public function getTimestamp(): int { return $this->timestamp; }
    public function getVersion(): string { return $this->version; }
    public function getServerId(): ?string { return $this->serverId; }
    
    // Setters
    public function setServerId(?string $serverId): void { $this->serverId = $serverId; }
    public function setData(array $data): void { $this->data = $data; }
    public function addData(string $key, $value): void { $this->data[$key] = $value; }
    
    // Type checks
    public function isRequest(): bool { return $this->type === self::TYPE_REQUEST; }
    public function isResponse(): bool { return $this->type === self::TYPE_RESPONSE; }
    public function isEvent(): bool { return $this->type === self::TYPE_EVENT; }
}
