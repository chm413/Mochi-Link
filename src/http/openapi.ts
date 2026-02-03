/**
 * OpenAPI/Swagger Documentation Generator
 * 
 * This file generates OpenAPI 3.0 specification for the Mochi-Link HTTP API
 */

import { OpenAPIV3 } from 'openapi-types';

export const openApiSpec: OpenAPIV3.Document = {
  openapi: '3.0.3',
  info: {
    title: 'Mochi-Link API',
    description: 'Minecraft 统一管理与监控系统 HTTP API',
    version: '1.0.0',
    contact: {
      name: 'Mochi-Link Support',
      url: 'https://github.com/your-org/koishi-plugin-mochi-link'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Development server'
    },
    {
      url: 'https://api.mochi-link.example.com',
      description: 'Production server'
    }
  ],
  security: [
    {
      bearerAuth: []
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      // Common schemas
      APIResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
          error: { type: 'string' },
          message: { type: 'string' },
          timestamp: { type: 'number' },
          requestId: { type: 'string' }
        },
        required: ['success', 'timestamp']
      },
      PaginationInfo: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          total: { type: 'number', minimum: 0 },
          totalPages: { type: 'number', minimum: 0 },
          hasNext: { type: 'boolean' },
          hasPrev: { type: 'boolean' }
        },
        required: ['page', 'limit', 'total', 'totalPages', 'hasNext', 'hasPrev']
      },
      ValidationError: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          message: { type: 'string' },
          value: { type: 'string' }
        },
        required: ['field', 'message']
      },
      
      // Server schemas
      ServerSummary: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          coreType: { type: 'string', enum: ['Java', 'Bedrock'] },
          coreName: { type: 'string' },
          status: { type: 'string', enum: ['online', 'offline', 'error', 'maintenance'] },
          playerCount: { type: 'number', minimum: 0 },
          maxPlayers: { type: 'number', minimum: 0 },
          uptime: { type: 'number', minimum: 0 },
          lastSeen: { type: 'string', format: 'date-time' },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['id', 'name', 'coreType', 'coreName', 'status', 'playerCount', 'maxPlayers', 'tags']
      },
      CreateServerRequest: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          coreType: { type: 'string', enum: ['Java', 'Bedrock'] },
          coreName: { type: 'string', minLength: 1, maxLength: 64 },
          coreVersion: { type: 'string', maxLength: 32 },
          connectionMode: { type: 'string', enum: ['plugin', 'rcon', 'terminal'] },
          connectionConfig: {
            type: 'object',
            properties: {
              plugin: {
                type: 'object',
                properties: {
                  host: { type: 'string', format: 'hostname' },
                  port: { type: 'number', minimum: 1, maximum: 65535 },
                  ssl: { type: 'boolean' },
                  path: { type: 'string' }
                },
                required: ['host', 'port']
              },
              rcon: {
                type: 'object',
                properties: {
                  host: { type: 'string', format: 'hostname' },
                  port: { type: 'number', minimum: 1, maximum: 65535 },
                  password: { type: 'string', minLength: 1 },
                  timeout: { type: 'number', minimum: 1000 }
                },
                required: ['host', 'port', 'password']
              },
              terminal: {
                type: 'object',
                properties: {
                  processId: { type: 'number', minimum: 1 },
                  workingDir: { type: 'string', minLength: 1 },
                  command: { type: 'string', minLength: 1 },
                  args: { type: 'array', items: { type: 'string' } }
                },
                required: ['processId', 'workingDir', 'command']
              }
            }
          },
          tags: { type: 'array', items: { type: 'string' } }
        },
        required: ['name', 'coreType', 'connectionMode', 'connectionConfig']
      },
      
      // Player schemas
      Player: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string', minLength: 3, maxLength: 16 },
          displayName: { type: 'string' },
          world: { type: 'string' },
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
              z: { type: 'number' }
            },
            required: ['x', 'y', 'z']
          },
          ping: { type: 'number', minimum: 0 },
          isOp: { type: 'boolean' },
          permissions: { type: 'array', items: { type: 'string' } }
        },
        required: ['id', 'name', 'displayName', 'world', 'position', 'ping', 'isOp', 'permissions']
      },
      KickPlayerRequest: {
        type: 'object',
        properties: {
          reason: { type: 'string', minLength: 1, maxLength: 255 }
        },
        required: ['reason']
      },
      
      // Whitelist schemas
      WhitelistEntry: {
        type: 'object',
        properties: {
          playerId: { type: 'string' },
          playerName: { type: 'string' },
          addedBy: { type: 'string' },
          addedAt: { type: 'string', format: 'date-time' },
          synced: { type: 'boolean' }
        },
        required: ['playerId', 'playerName', 'addedBy', 'addedAt', 'synced']
      },
      AddWhitelistRequest: {
        type: 'object',
        properties: {
          playerId: { type: 'string', minLength: 1 },
          playerName: { type: 'string', minLength: 3, maxLength: 16 }
        },
        required: ['playerId']
      },
      
      // Ban schemas
      BanEntry: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['player', 'ip', 'device'] },
          target: { type: 'string' },
          reason: { type: 'string' },
          bannedBy: { type: 'string' },
          bannedAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time' },
          active: { type: 'boolean' }
        },
        required: ['id', 'type', 'target', 'reason', 'bannedBy', 'bannedAt', 'active']
      },
      CreateBanRequest: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['player', 'ip', 'device'] },
          target: { type: 'string', minLength: 1 },
          reason: { type: 'string', minLength: 1, maxLength: 255 },
          duration: { type: 'number', minimum: 1 }
        },
        required: ['type', 'target', 'reason']
      },
      
      // Command schemas
      ExecuteCommandRequest: {
        type: 'object',
        properties: {
          command: { type: 'string', minLength: 1, maxLength: 1000 },
          timeout: { type: 'number', minimum: 1000, maximum: 300000 }
        },
        required: ['command']
      },
      CommandResult: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          output: { type: 'array', items: { type: 'string' } },
          executionTime: { type: 'number', minimum: 0 },
          error: { type: 'string' }
        },
        required: ['success', 'output', 'executionTime']
      },
      
      // System schemas
      SystemHealth: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          uptime: { type: 'number', minimum: 0 },
          version: { type: 'string' },
          services: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                details: { type: 'object' }
              },
              required: ['name', 'status']
            }
          },
          database: {
            type: 'object',
            properties: {
              connected: { type: 'boolean' },
              responseTime: { type: 'number', minimum: 0 }
            },
            required: ['connected']
          },
          connections: {
            type: 'object',
            properties: {
              active: { type: 'number', minimum: 0 },
              total: { type: 'number', minimum: 0 },
              byStatus: { type: 'object' }
            },
            required: ['active', 'total', 'byStatus']
          }
        },
        required: ['status', 'uptime', 'version', 'services', 'database', 'connections']
      }
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/APIResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string', enum: ['VALIDATION_ERROR'] },
                    details: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ValidationError' }
                    }
                  }
                }
              ]
            }
          }
        }
      },
      Unauthorized: {
        description: 'Authentication required',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/APIResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string', enum: ['AUTH_ERROR'] }
                  }
                }
              ]
            }
          }
        }
      },
      Forbidden: {
        description: 'Permission denied',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/APIResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string', enum: ['PERMISSION_DENIED'] }
                  }
                }
              ]
            }
          }
        }
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/APIResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string', enum: ['NOT_FOUND'] }
                  }
                }
              ]
            }
          }
        }
      },
      ServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: {
              allOf: [
                { $ref: '#/components/schemas/APIResponse' },
                {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', enum: [false] },
                    error: { type: 'string', enum: ['INTERNAL_ERROR', 'SERVER_ERROR'] }
                  }
                }
              ]
            }
          }
        }
      }
    },
    parameters: {
      ServerId: {
        name: 'serverId',
        in: 'path',
        required: true,
        description: 'Server unique identifier',
        schema: {
          type: 'string',
          pattern: '^[a-zA-Z0-9_-]+$'
        }
      },
      PlayerId: {
        name: 'playerId',
        in: 'path',
        required: true,
        description: 'Player unique identifier (UUID or XUID)',
        schema: {
          type: 'string'
        }
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: {
          type: 'number',
          minimum: 1,
          default: 1
        }
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Number of items per page',
        schema: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          default: 20
        }
      }
    }
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['System'],
        summary: 'Get system health status',
        description: 'Returns the current health status of the system and its components',
        responses: {
          '200': {
            description: 'System health information',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/SystemHealth' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/servers': {
      get: {
        tags: ['Servers'],
        summary: 'List servers',
        description: 'Get a paginated list of servers accessible to the authenticated user',
        parameters: [
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' }
        ],
        responses: {
          '200': {
            description: 'List of servers',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/ServerSummary' }
                        },
                        pagination: { $ref: '#/components/schemas/PaginationInfo' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      post: {
        tags: ['Servers'],
        summary: 'Create server',
        description: 'Register a new Minecraft server',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateServerRequest' }
            }
          }
        },
        responses: {
          '201': {
            description: 'Server created successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            serverId: { type: 'string' },
                            token: { type: 'string' }
                          },
                          required: ['serverId', 'token']
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/servers/{serverId}': {
      get: {
        tags: ['Servers'],
        summary: 'Get server details',
        description: 'Get detailed information about a specific server',
        parameters: [
          { $ref: '#/components/parameters/ServerId' }
        ],
        responses: {
          '200': {
            description: 'Server details',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/ServerSummary' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      put: {
        tags: ['Servers'],
        summary: 'Update server',
        description: 'Update server configuration',
        parameters: [
          { $ref: '#/components/parameters/ServerId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string', minLength: 1, maxLength: 255 },
                  connectionConfig: { type: 'object' },
                  tags: { type: 'array', items: { type: 'string' } }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Server updated successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/ServerSummary' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      },
      delete: {
        tags: ['Servers'],
        summary: 'Delete server',
        description: 'Remove a server from the system',
        parameters: [
          { $ref: '#/components/parameters/ServerId' }
        ],
        responses: {
          '200': {
            description: 'Server deleted successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            deleted: { type: 'boolean', enum: [true] }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/servers/{serverId}/players': {
      get: {
        tags: ['Players'],
        summary: 'List players',
        description: 'Get a list of online players on the server',
        parameters: [
          { $ref: '#/components/parameters/ServerId' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' }
        ],
        responses: {
          '200': {
            description: 'List of players',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: { $ref: '#/components/schemas/Player' }
                        },
                        summary: {
                          type: 'object',
                          properties: {
                            online: { type: 'number' },
                            total: { type: 'number' },
                            byEdition: {
                              type: 'object',
                              properties: {
                                java: { type: 'number' },
                                bedrock: { type: 'number' }
                              }
                            }
                          }
                        },
                        pagination: { $ref: '#/components/schemas/PaginationInfo' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/servers/{serverId}/players/{playerId}/kick': {
      post: {
        tags: ['Players'],
        summary: 'Kick player',
        description: 'Kick a player from the server',
        parameters: [
          { $ref: '#/components/parameters/ServerId' },
          { $ref: '#/components/parameters/PlayerId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/KickPlayerRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Player kicked successfully',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            success: { type: 'boolean' }
                          }
                        }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    },
    '/api/servers/{serverId}/commands': {
      post: {
        tags: ['Commands'],
        summary: 'Execute command',
        description: 'Execute a console command on the server',
        parameters: [
          { $ref: '#/components/parameters/ServerId' }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ExecuteCommandRequest' }
            }
          }
        },
        responses: {
          '200': {
            description: 'Command executed',
            content: {
              'application/json': {
                schema: {
                  allOf: [
                    { $ref: '#/components/schemas/APIResponse' },
                    {
                      type: 'object',
                      properties: {
                        data: { $ref: '#/components/schemas/CommandResult' }
                      }
                    }
                  ]
                }
              }
            }
          },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
          '500': { $ref: '#/components/responses/ServerError' }
        }
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status endpoints'
    },
    {
      name: 'Servers',
      description: 'Server management operations'
    },
    {
      name: 'Players',
      description: 'Player management operations'
    },
    {
      name: 'Commands',
      description: 'Command execution operations'
    },
    {
      name: 'Whitelist',
      description: 'Whitelist management operations'
    },
    {
      name: 'Bans',
      description: 'Ban management operations'
    },
    {
      name: 'Monitoring',
      description: 'Server monitoring and metrics'
    },
    {
      name: 'Audit',
      description: 'Audit log operations'
    }
  ]
};

/**
 * Generate OpenAPI specification as JSON string
 */
export function generateOpenApiSpec(): string {
  return JSON.stringify(openApiSpec, null, 2);
}

/**
 * Generate OpenAPI specification as YAML string
 */
export function generateOpenApiYaml(): string {
  // Simple YAML conversion for basic structure
  // In production, you might want to use a proper YAML library
  const yamlLines: string[] = [];
  
  function addYamlLine(line: string, indent = 0) {
    yamlLines.push('  '.repeat(indent) + line);
  }
  
  addYamlLine('openapi: 3.0.3');
  addYamlLine('info:');
  addYamlLine(`title: "${openApiSpec.info.title}"`, 1);
  addYamlLine(`description: "${openApiSpec.info.description}"`, 1);
  addYamlLine(`version: "${openApiSpec.info.version}"`, 1);
  
  addYamlLine('servers:');
  openApiSpec.servers?.forEach(server => {
    addYamlLine(`- url: "${server.url}"`, 1);
    addYamlLine(`  description: "${server.description}"`, 1);
  });
  
  addYamlLine('# For complete specification, use the JSON endpoint');
  
  return yamlLines.join('\n');
}