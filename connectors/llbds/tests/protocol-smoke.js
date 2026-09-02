'use strict';

const assert = require('node:assert/strict');
const { createHmac } = require('node:crypto');
const { MochiLinkConnectionManager } = require('../dist/network/MochiLinkConnectionManager.js');

const token = 'bedrock-secret';
const config = {
  getRetryDelay: () => 100,
  getRetryAttempts: () => 1,
  getServerId: () => 'llbds-test',
  getServerName: () => 'LLBDS Test',
  getAuthToken: () => token
};
const logger = {
  info() {},
  warn() {},
  error() {},
  debug() {}
};

async function main() {
  const manager = new MochiLinkConnectionManager(config, logger);
  const sent = [];
  manager.send = async (message) => sent.push(message);

  const challenge = 'nonce-456';
  const challengeTimestamp = 1725000000456;
  await manager.handleHandshake({
    id: 'challenge-request',
    timestamp: challengeTimestamp,
    data: { challenge, challengeTimestamp }
  });

  const handshake = sent.shift();
  assert.equal(handshake.type, 'system');
  assert.equal(handshake.systemOp, 'handshake');
  assert.equal(handshake.requestId, 'challenge-request');
  assert.equal(handshake.data.authentication.method, 'challenge');
  assert.deepEqual(handshake.data.capabilities, [
    'player_management',
    'command_execution',
    'performance_monitoring',
    'event_streaming'
  ]);
  assert.equal(handshake.data.challengeResponse, createHmac('sha256', token)
    .update(`${challenge}:${token}:${challengeTimestamp}`, 'utf8')
    .digest('hex'));

  await manager.handlePing({ id: 'ping-request' });
  const pong = sent.shift();
  assert.equal(pong.type, 'system');
  assert.equal(pong.systemOp, 'pong');
  assert.equal(pong.requestId, 'ping-request');
  assert.equal(pong.version, '2.0');
  assert.equal(typeof pong.timestamp, 'number');

  process.stdout.write('LLBDS_PROTOCOL_RESULT=PASS\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
