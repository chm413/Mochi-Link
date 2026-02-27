/**
 * Database Models Tests
 * 
 * This file contains tests for database models and utilities.
 */

import { ModelUtils } from '../../src/database/models';
import { DatabaseServer, ServerConfig } from '../../src/types';

describe('Database Models', () => {
  describe('ModelUtils', () => {
    describe('dbServerToModel', () => {
      it('should convert database server to application model', () => {
        const dbServer: DatabaseServer = {
          id: 'test-server',
          name: 'Test Server',
          core_type: 'Java',
          core_name: 'Paper',
          core_version: '1.20.1',
          connection_mode: 'plugin',
          connection_config: JSON.stringify({
            plugin: { host: '127.0.0.1', port: 8080, ssl: false }
          }),
          status: 'offline',
          owner_id: 'user123',
          tags: JSON.stringify(['test', 'development']),
          created_at: new Date('2023-01-01'),
          updated_at: new Date('2023-01-02'),
          last_seen: new Date('2023-01-03')
        };

        const model = ModelUtils.dbServerToModel(dbServer);

        expect(model.id).toBe('test-server');
        expect(model.coreType).toBe('Java');
        expect(model.connectionMode).toBe('plugin');
        expect(model.connectionConfig).toEqual({
          plugin: { host: '127.0.0.1', port: 8080, ssl: false }
        });
        expect(model.tags).toEqual(['test', 'development']);
      });

      it('should handle JSON parsing for connection config', () => {
        const dbServer: DatabaseServer = {
          id: 'test-server',
          name: 'Test Server',
          core_type: 'Java',
          core_name: 'Paper',
          core_version: '1.20.1',
          connection_mode: 'rcon',
          connection_config: JSON.stringify({
            rcon: { host: '127.0.0.1', port: 25575, password: 'secret' }
          }),
          status: 'online',
          owner_id: 'user123',
          tags: JSON.stringify([]),
          created_at: new Date(),
          updated_at: new Date()
        };

        const model = ModelUtils.dbServerToModel(dbServer);

        expect(model.connectionConfig.rcon).toEqual({
          host: '127.0.0.1',
          port: 25575,
          password: 'secret'
        });
      });
    });

    describe('modelToDbServer', () => {
      it('should convert application model to database server', () => {
        const model: Partial<ServerConfig> = {
          id: 'test-server',
          name: 'Test Server',
          coreType: 'Bedrock',
          coreName: 'LLBDS',
          coreVersion: '1.20.1',
          connectionMode: 'terminal',
          connectionConfig: {
            terminal: { processId: 1234, workingDir: '/opt/server', command: 'bedrock_server' }
          },
          status: 'online',
          ownerId: 'user456',
          tags: ['production', 'bedrock']
        };

        const dbServer = ModelUtils.modelToDbServer(model);

        expect(dbServer.id).toBe('test-server');
        expect(dbServer.core_type).toBe('Bedrock');
        expect(dbServer.connection_mode).toBe('terminal');
        expect(dbServer.connection_config).toBe(JSON.stringify({
          terminal: { processId: 1234, workingDir: '/opt/server', command: 'bedrock_server' }
        }));
        expect(dbServer.tags).toBe(JSON.stringify(['production', 'bedrock']));
        expect(dbServer.updated_at).toBeInstanceOf(Date);
      });
    });

    describe('dbACLToModel', () => {
      it('should convert database ACL to application model', () => {
        const dbACL = {
          id: 1,
          user_id: 'user123',
          server_id: 'server123',
          role: 'admin',
          permissions: JSON.stringify(['server.manage', 'player.kick']),
          granted_by: 'owner123',
          granted_at: new Date('2023-01-01'),
          expires_at: new Date('2023-12-31')
        };

        const model = ModelUtils.dbACLToModel(dbACL);

        expect(model.userId).toBe('user123');
        expect(model.serverId).toBe('server123');
        expect(model.role).toBe('admin');
        expect(model.permissions).toEqual(['server.manage', 'player.kick']);
        expect(model.grantedBy).toBe('owner123');
      });
    });

    describe('dbAuditToModel', () => {
      it('should convert database audit log to application model', () => {
        const dbAudit = {
          id: 1,
          user_id: 'user123',
          server_id: 'server123',
          operation: 'player.kick',
          operation_data: JSON.stringify({ playerId: 'player123', reason: 'test' }),
          result: 'success',
          error_message: undefined,
          ip_address: '127.0.0.1',
          user_agent: 'MochiLink/1.0',
          created_at: new Date('2023-01-01')
        };

        const model = ModelUtils.dbAuditToModel(dbAudit);

        expect(model.userId).toBe('user123');
        expect(model.operation).toBe('player.kick');
        expect(model.operationData).toEqual({ playerId: 'player123', reason: 'test' });
        expect(model.result).toBe('success');
        expect(model.ipAddress).toBe('127.0.0.1');
      });
    });
  });
});