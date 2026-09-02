<?php

declare(strict_types=1);

namespace pocketmine\utils {
    final class TextFormat {}
}

namespace com\mochilink\connector\common {
    interface ReconnectionCallback {}
    final class ReconnectionConfig {
        public function __construct(...$args) {}
    }
    final class ReconnectionManager {
        public function __construct(...$args) {}
        public function getStatus(): array { return []; }
        public function enable(): void {}
        public function disable(): void {}
        public function cancel(): void {}
        public function reset(): void {}
        public function scheduleReconnect(): void {}
    }
}

namespace com\mochilink\connector\pmmp {
    class MochiLinkPMMPPlugin {
        public function getLogger(): object {
            return new class {
                public function info(...$args): void {}
                public function warning(...$args): void {}
                public function error(...$args): void {}
                public function debug(...$args): void {}
            };
        }
    }
}

namespace com\mochilink\connector\pmmp\config {
    class PMMPPluginConfig {
        public function getRetryDelay(): int { return 100; }
        public function getRetryAttempts(): int { return 1; }
        public function getServerId(): string { return 'pmmp-test'; }
        public function getServerName(): string { return 'PMMP Test'; }
        public function getAuthToken(): string { return 'pmmp-secret'; }
    }
}

namespace {
    use com\mochilink\connector\pmmp\MochiLinkPMMPPlugin;
    use com\mochilink\connector\pmmp\config\PMMPPluginConfig;
    use com\mochilink\connector\pmmp\connection\PMMPConnectionManager;
    use com\mochilink\connector\pmmp\protocol\UWBPMessage;

    require_once __DIR__ . '/../src/com/mochilink/connector/pmmp/protocol/UWBPMessage.php';
    require_once __DIR__ . '/../src/com/mochilink/connector/pmmp/connection/PMMPConnectionManager.php';

    function check(bool $condition, string $message): void {
        if (!$condition) throw new RuntimeException($message);
    }

    $response = UWBPMessage::createResponse(
        'request-1',
        'server.getStatus',
        ['status' => 'online', 'online' => true],
        true,
        null,
        'pmmp-test'
    )->toArray();
    check($response['type'] === 'response', 'response type mismatch');
    check($response['requestId'] === 'request-1', 'requestId mismatch');
    check($response['id'] !== 'request-1', 'response must own its id');
    check(is_int($response['timestamp']), 'timestamp must be an integer');
    check($response['version'] === '2.0', 'version mismatch');
    check($response['data']['status'] === 'online', 'status payload mismatch');
    check($response['data']['online'] === true, 'online payload mismatch');

    $manager = new PMMPConnectionManager(new MochiLinkPMMPPlugin(), new PMMPPluginConfig());
    $reflection = new ReflectionClass($manager);
    $handshakeMethod = $reflection->getMethod('sendHandshake');
    $handshakeMethod->setAccessible(true);
    $timestamp = 1725000000789;
    $handshakeMethod->invoke($manager, [
        'id' => 'challenge-request',
        'timestamp' => $timestamp,
        'data' => ['challenge' => 'nonce-789', 'challengeTimestamp' => $timestamp]
    ]);
    $queueProperty = $reflection->getProperty('messageQueue');
    $queueProperty->setAccessible(true);
    $queue = $queueProperty->getValue($manager);
    $handshake = $queue[0]->toArray();
    check($handshake['type'] === 'system', 'handshake type mismatch');
    check($handshake['requestId'] === 'challenge-request', 'handshake correlation mismatch');
    check($handshake['data']['authentication']['method'] === 'challenge', 'challenge method mismatch');
    check($handshake['data']['capabilities'] === [
        'player_management',
        'command_execution',
        'performance_monitoring',
        'event_streaming',
        'whitelist_management',
        'server_control'
    ], 'capability declaration mismatch');
    check($handshake['data']['challengeResponse'] === hash_hmac(
        'sha256',
        'nonce-789:pmmp-secret:' . $timestamp,
        'pmmp-secret'
    ), 'challenge HMAC mismatch');

    $createFrame = $reflection->getMethod('createWebSocketFrame');
    $parseFrame = $reflection->getMethod('parseWebSocketFrame');
    $createFrame->setAccessible(true);
    $parseFrame->setAccessible(true);
    foreach (["short", str_repeat('a', 126), str_repeat('b', 70000)] as $payload) {
        $frame = $createFrame->invoke($manager, $payload);
        check($parseFrame->invoke($manager, $frame) === $payload, 'WebSocket frame roundtrip failed');
    }

    echo "PMMP_PROTOCOL_RESULT=PASS\n";
}
