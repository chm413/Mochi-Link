<?php

declare(strict_types=1);

namespace com\mochilink\connector\pmmp\protocol;

/**
 * U-WBP v2 message value object.
 *
 * Builders always emit the canonical envelope. The parser accepts the old
 * nested response fields and ISO timestamps so an upgrade can interoperate
 * with older management endpoints.
 */
class UWBPMessage {
    public const VERSION = '2.0';
    public const PROTOCOL_NAME = 'U-WBP';

    public const TYPE_REQUEST = 'request';
    public const TYPE_RESPONSE = 'response';
    public const TYPE_EVENT = 'event';
    public const TYPE_SYSTEM = 'system';

    private string $type;
    private string $id;
    private string $op;
    private array $data;
    private int $timestamp;
    private string $version;
    private ?string $serverId;
    private ?string $requestId = null;
    private ?bool $success = null;
    private ?string $error = null;
    private ?string $systemOp = null;

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
        $this->timestamp = (int) (microtime(true) * 1000);
        $this->version = self::VERSION;
        $this->serverId = $serverId;
    }

    public static function createRequest(string $op, array $data = [], ?string $serverId = null): self {
        return new self(self::TYPE_REQUEST, $op, $data, $serverId);
    }

    public static function createResponse(
        string $requestId,
        string $op,
        array $data = [],
        bool $success = true,
        ?string $error = null,
        ?string $serverId = null
    ): self {
        $message = new self(self::TYPE_RESPONSE, $op, $data, $serverId);
        $message->requestId = $requestId;
        $message->success = $success;
        $message->error = $error;
        return $message;
    }

    public static function createError(
        string $requestId,
        string $op,
        string $code,
        string $error,
        ?string $serverId = null
    ): self {
        $message = self::createResponse($requestId, $op, ['code' => $code], false, $error, $serverId);
        return $message;
    }

    public static function createEvent(string $op, array $data = [], ?string $serverId = null): self {
        return new self(self::TYPE_EVENT, $op, $data, $serverId);
    }

    public static function createSystem(
        string $systemOp,
        array $data = [],
        ?string $serverId = null,
        ?string $requestId = null
    ): self {
        $message = new self(self::TYPE_SYSTEM, $systemOp, $data, $serverId);
        $message->systemOp = $systemOp;
        $message->requestId = $requestId;
        return $message;
    }

    public static function fromJson(string $json): ?self {
        $decoded = json_decode($json, true);
        if (!is_array($decoded) || !isset($decoded['type'], $decoded['id'])) {
            return null;
        }

        $op = (string) ($decoded['op'] ?? $decoded['systemOp'] ?? '');
        $message = new self(
            (string) $decoded['type'],
            $op,
            is_array($decoded['data'] ?? null) ? $decoded['data'] : [],
            isset($decoded['serverId']) ? (string) $decoded['serverId'] : null
        );

        $message->id = (string) $decoded['id'];
        $message->timestamp = self::parseTimestamp($decoded['timestamp'] ?? null);
        $message->version = (string) ($decoded['version'] ?? self::VERSION);
        $message->requestId = isset($decoded['requestId'])
            ? (string) $decoded['requestId']
            : (isset($decoded['data']['requestId']) ? (string) $decoded['data']['requestId'] : null);
        $message->success = array_key_exists('success', $decoded)
            ? (bool) $decoded['success']
            : (array_key_exists('success', $message->data) ? (bool) $message->data['success'] : null);
        $message->error = isset($decoded['error'])
            ? (string) $decoded['error']
            : (isset($decoded['data']['error']) ? (string) $decoded['data']['error'] : null);
        $message->systemOp = isset($decoded['systemOp']) ? (string) $decoded['systemOp'] : null;

        return $message;
    }

    public function toJson(): string {
        return json_encode($this->toArray(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    public function toArray(): array {
        $output = [
            'type' => $this->type,
            'id' => $this->id,
            'op' => $this->op,
            'data' => $this->data,
            'timestamp' => $this->timestamp,
            'version' => $this->version
        ];
        if ($this->type === self::TYPE_EVENT) {
            $output['eventType'] = $this->op;
        }
        if ($this->serverId !== null) $output['serverId'] = $this->serverId;
        if ($this->requestId !== null) $output['requestId'] = $this->requestId;
        if ($this->success !== null) $output['success'] = $this->success;
        if ($this->error !== null) $output['error'] = $this->error;
        if ($this->systemOp !== null) $output['systemOp'] = $this->systemOp;
        return $output;
    }

    private function generateId(): string {
        return sprintf('%d-%s', (int) (microtime(true) * 1000), bin2hex(random_bytes(4)));
    }

    private static function parseTimestamp($value): int {
        if (is_int($value) || is_float($value) || (is_string($value) && is_numeric($value))) {
            return (int) $value;
        }
        if (is_string($value)) {
            $parsed = strtotime($value);
            if ($parsed !== false) return $parsed * 1000;
        }
        return (int) (microtime(true) * 1000);
    }

    public function getType(): string { return $this->type; }
    public function getId(): string { return $this->id; }
    public function getOp(): string { return $this->op; }
    public function getData(): array { return $this->data; }
    public function getTimestamp(): int { return $this->timestamp; }
    public function getVersion(): string { return $this->version; }
    public function getServerId(): ?string { return $this->serverId; }
    public function getRequestId(): ?string { return $this->requestId; }
    public function getSuccess(): ?bool { return $this->success; }
    public function getError(): ?string { return $this->error; }
    public function getSystemOp(): ?string { return $this->systemOp; }

    public function setServerId(?string $serverId): void { $this->serverId = $serverId; }
    public function setData(array $data): void { $this->data = $data; }
    public function addData(string $key, $value): void { $this->data[$key] = $value; }

    public function isRequest(): bool { return $this->type === self::TYPE_REQUEST; }
    public function isResponse(): bool { return $this->type === self::TYPE_RESPONSE; }
    public function isEvent(): bool { return $this->type === self::TYPE_EVENT; }
    public function isSystem(): bool { return $this->type === self::TYPE_SYSTEM; }
}
