/**
 * API Versioning Support
 * 
 * Handles API version management, compatibility, and routing
 */

import { HTTPRequest } from './types';
import { APIResponse } from './types';

export interface APIVersion {
  version: string;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  supportedUntil?: Date;
  changelog?: string[];
}

export interface VersionedEndpoint {
  path: string;
  method: string;
  versions: Map<string, Function>;
  defaultVersion: string;
  deprecatedVersions: Set<string>;
}

export class APIVersionManager {
  private supportedVersions: Map<string, APIVersion> = new Map();
  private versionedEndpoints: Map<string, VersionedEndpoint> = new Map();
  private defaultVersion = 'v1';

  constructor() {
    this.initializeSupportedVersions();
  }

  private initializeSupportedVersions(): void {
    // Version 1.0 - Initial release
    this.supportedVersions.set('v1', {
      version: 'v1',
      changelog: [
        'Initial API release',
        'Server management endpoints',
        'Player management endpoints',
        'Command execution endpoints',
        'Whitelist and ban management',
        'Basic monitoring endpoints'
      ]
    });

    // Version 1.1 - Enhanced features (future)
    this.supportedVersions.set('v1.1', {
      version: 'v1.1',
      changelog: [
        'Enhanced monitoring with real-time metrics',
        'Batch operation support',
        'Advanced filtering and search',
        'Webhook support for events',
        'Performance optimizations'
      ]
    });

    // Version 2.0 - Major revision (future)
    this.supportedVersions.set('v2', {
      version: 'v2',
      changelog: [
        'Breaking changes to response format',
        'GraphQL support',
        'Enhanced security features',
        'Multi-tenant support',
        'Advanced analytics'
      ]
    });
  }

  /**
   * Extract API version from request
   */
  extractVersion(request: HTTPRequest): string {
    // Check Accept header first (preferred method)
    const acceptHeader = request.headers['accept'];
    if (acceptHeader) {
      const versionMatch = acceptHeader.match(/application\/vnd\.mochi-link\.v(\d+(?:\.\d+)?)\+json/);
      if (versionMatch) {
        return `v${versionMatch[1]}`;
      }
    }

    // Check custom header
    const versionHeader = request.headers['x-api-version'] || request.headers['api-version'];
    if (versionHeader) {
      return this.normalizeVersion(versionHeader as string);
    }

    // Check query parameter
    if (request.query.version) {
      return this.normalizeVersion(request.query.version as string);
    }

    // Check URL path prefix
    const pathMatch = request.path.match(/^\/api\/v(\d+(?:\.\d+)?)\//);
    if (pathMatch) {
      return `v${pathMatch[1]}`;
    }

    // Return default version
    return this.defaultVersion;
  }

  /**
   * Normalize version string to standard format
   */
  private normalizeVersion(version: string): string {
    // Remove 'v' prefix if present
    const cleanVersion = version.replace(/^v/i, '');
    
    // Add 'v' prefix
    return `v${cleanVersion}`;
  }

  /**
   * Check if version is supported
   */
  isVersionSupported(version: string): boolean {
    return this.supportedVersions.has(version);
  }

  /**
   * Get version information
   */
  getVersionInfo(version: string): APIVersion | null {
    return this.supportedVersions.get(version) || null;
  }

  /**
   * Get all supported versions
   */
  getSupportedVersions(): APIVersion[] {
    return Array.from(this.supportedVersions.values());
  }

  /**
   * Check if version is deprecated
   */
  isVersionDeprecated(version: string): boolean {
    const versionInfo = this.supportedVersions.get(version);
    return versionInfo?.deprecated || false;
  }

  /**
   * Get deprecation warnings for version
   */
  getDeprecationWarnings(version: string): string[] {
    const versionInfo = this.supportedVersions.get(version);
    const warnings: string[] = [];

    if (versionInfo?.deprecated) {
      warnings.push(`API version ${version} is deprecated`);
      
      if (versionInfo.deprecationDate) {
        warnings.push(`Deprecated since: ${versionInfo.deprecationDate.toISOString()}`);
      }
      
      if (versionInfo.sunsetDate) {
        warnings.push(`Will be removed on: ${versionInfo.sunsetDate.toISOString()}`);
      }
      
      if (versionInfo.supportedUntil) {
        warnings.push(`Support ends: ${versionInfo.supportedUntil.toISOString()}`);
      }
    }

    return warnings;
  }

  /**
   * Add version-specific headers to response
   */
  addVersionHeaders(response: APIResponse, version: string, requestId?: string): APIResponse {
    const versionInfo = this.supportedVersions.get(version);
    
    const versionedResponse = {
      ...response,
      version,
      apiVersion: version,
      supportedVersions: Array.from(this.supportedVersions.keys()),
      requestId
    };

    // Add deprecation warnings if applicable
    const warnings = this.getDeprecationWarnings(version);
    if (warnings.length > 0) {
      versionedResponse.warnings = warnings;
    }

    return versionedResponse;
  }

  /**
   * Create version compatibility response
   */
  createVersionCompatibilityResponse(requestedVersion: string, requestId?: string): APIResponse {
    const supportedVersions = Array.from(this.supportedVersions.keys());
    const latestVersion = supportedVersions[supportedVersions.length - 1];

    return {
      success: false,
      error: 'VERSION_NOT_SUPPORTED',
      message: `API version ${requestedVersion} is not supported`,
      data: {
        requestedVersion,
        supportedVersions,
        latestVersion,
        defaultVersion: this.defaultVersion,
        upgradeInstructions: `Please upgrade to version ${latestVersion} or use the default version ${this.defaultVersion}`
      },
      timestamp: Date.now(),
      requestId
    };
  }

  /**
   * Register versioned endpoint
   */
  registerVersionedEndpoint(
    path: string, 
    method: string, 
    versions: Record<string, Function>,
    defaultVersion?: string
  ): void {
    const endpointKey = `${method}:${path}`;
    const versionMap = new Map(Object.entries(versions));
    
    this.versionedEndpoints.set(endpointKey, {
      path,
      method,
      versions: versionMap,
      defaultVersion: defaultVersion || this.defaultVersion,
      deprecatedVersions: new Set()
    });
  }

  /**
   * Get handler for versioned endpoint
   */
  getVersionedHandler(path: string, method: string, version: string): Function | null {
    const endpointKey = `${method}:${path}`;
    const endpoint = this.versionedEndpoints.get(endpointKey);
    
    if (!endpoint) {
      return null;
    }

    // Try exact version match first
    let handler = endpoint.versions.get(version);
    if (handler) {
      return handler;
    }

    // Try fallback to default version
    handler = endpoint.versions.get(endpoint.defaultVersion);
    if (handler) {
      return handler;
    }

    // Try latest available version
    const availableVersions = Array.from(endpoint.versions.keys()).sort();
    const latestVersion = availableVersions[availableVersions.length - 1];
    return endpoint.versions.get(latestVersion) || null;
  }

  /**
   * Mark version as deprecated
   */
  deprecateVersion(version: string, deprecationDate?: Date, sunsetDate?: Date): void {
    const versionInfo = this.supportedVersions.get(version);
    if (versionInfo) {
      versionInfo.deprecated = true;
      if (deprecationDate) versionInfo.deprecationDate = deprecationDate;
      if (sunsetDate) versionInfo.sunsetDate = sunsetDate;
    }
  }

  /**
   * Remove support for version
   */
  removeVersionSupport(version: string): void {
    this.supportedVersions.delete(version);
    
    // Remove from all endpoints
    for (const endpoint of this.versionedEndpoints.values()) {
      endpoint.versions.delete(version);
      endpoint.deprecatedVersions.delete(version);
    }
  }

  /**
   * Get API version compatibility matrix
   */
  getCompatibilityMatrix(): Record<string, any> {
    const matrix: Record<string, any> = {};
    
    for (const [version, info] of this.supportedVersions.entries()) {
      matrix[version] = {
        supported: true,
        deprecated: info.deprecated || false,
        deprecationDate: info.deprecationDate?.toISOString(),
        sunsetDate: info.sunsetDate?.toISOString(),
        supportedUntil: info.supportedUntil?.toISOString(),
        changelog: info.changelog || []
      };
    }
    
    return matrix;
  }

  /**
   * Validate version format
   */
  validateVersionFormat(version: string): boolean {
    // Accept formats: v1, v1.0, v1.1, v2, etc.
    const versionRegex = /^v\d+(\.\d+)?$/;
    return versionRegex.test(version);
  }

  /**
   * Get migration guide for version upgrade
   */
  getMigrationGuide(fromVersion: string, toVersion: string): string[] {
    const migrationSteps: string[] = [];
    
    // This would contain actual migration instructions
    // For now, return generic guidance
    migrationSteps.push(`Upgrading from ${fromVersion} to ${toVersion}`);
    migrationSteps.push('1. Review breaking changes in the changelog');
    migrationSteps.push('2. Update your client code to handle new response formats');
    migrationSteps.push('3. Test your integration thoroughly');
    migrationSteps.push('4. Update your Accept headers or version parameters');
    
    return migrationSteps;
  }

  /**
   * Create version information endpoint response
   */
  createVersionInfoResponse(requestId?: string): APIResponse {
    return {
      success: true,
      data: {
        currentVersion: this.defaultVersion,
        supportedVersions: this.getSupportedVersions(),
        compatibilityMatrix: this.getCompatibilityMatrix(),
        versioningMethods: [
          'Accept header: application/vnd.mochi-link.v1+json',
          'Custom header: X-API-Version: v1',
          'Query parameter: ?version=v1',
          'URL path: /api/v1/...'
        ]
      },
      timestamp: Date.now(),
      requestId
    };
  }
}

/**
 * Version-aware middleware for handling API versioning
 */
export class VersioningMiddleware {
  constructor(private versionManager: APIVersionManager) {}

  async handle(request: HTTPRequest): Promise<{
    continue: boolean;
    version: string;
    warnings?: string[];
  }> {
    const requestedVersion = this.versionManager.extractVersion(request);
    
    // Validate version format
    if (!this.versionManager.validateVersionFormat(requestedVersion)) {
      return {
        continue: false,
        version: requestedVersion
      };
    }

    // Check if version is supported
    if (!this.versionManager.isVersionSupported(requestedVersion)) {
      return {
        continue: false,
        version: requestedVersion
      };
    }

    // Get deprecation warnings
    const warnings = this.versionManager.getDeprecationWarnings(requestedVersion);

    return {
      continue: true,
      version: requestedVersion,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }
}