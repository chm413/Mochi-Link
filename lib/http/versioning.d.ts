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
export declare class APIVersionManager {
    private supportedVersions;
    private versionedEndpoints;
    private defaultVersion;
    constructor();
    private initializeSupportedVersions;
    /**
     * Extract API version from request
     */
    extractVersion(request: HTTPRequest): string;
    /**
     * Normalize version string to standard format
     */
    private normalizeVersion;
    /**
     * Check if version is supported
     */
    isVersionSupported(version: string): boolean;
    /**
     * Get version information
     */
    getVersionInfo(version: string): APIVersion | null;
    /**
     * Get all supported versions
     */
    getSupportedVersions(): APIVersion[];
    /**
     * Check if version is deprecated
     */
    isVersionDeprecated(version: string): boolean;
    /**
     * Get deprecation warnings for version
     */
    getDeprecationWarnings(version: string): string[];
    /**
     * Add version-specific headers to response
     */
    addVersionHeaders(response: APIResponse, version: string, requestId?: string): APIResponse;
    /**
     * Create version compatibility response
     */
    createVersionCompatibilityResponse(requestedVersion: string, requestId?: string): APIResponse;
    /**
     * Register versioned endpoint
     */
    registerVersionedEndpoint(path: string, method: string, versions: Record<string, Function>, defaultVersion?: string): void;
    /**
     * Get handler for versioned endpoint
     */
    getVersionedHandler(path: string, method: string, version: string): Function | null;
    /**
     * Mark version as deprecated
     */
    deprecateVersion(version: string, deprecationDate?: Date, sunsetDate?: Date): void;
    /**
     * Remove support for version
     */
    removeVersionSupport(version: string): void;
    /**
     * Get API version compatibility matrix
     */
    getCompatibilityMatrix(): Record<string, any>;
    /**
     * Validate version format
     */
    validateVersionFormat(version: string): boolean;
    /**
     * Get migration guide for version upgrade
     */
    getMigrationGuide(fromVersion: string, toVersion: string): string[];
    /**
     * Create version information endpoint response
     */
    createVersionInfoResponse(requestId?: string): APIResponse;
}
/**
 * Version-aware middleware for handling API versioning
 */
export declare class VersioningMiddleware {
    private versionManager;
    constructor(versionManager: APIVersionManager);
    handle(request: HTTPRequest): Promise<{
        continue: boolean;
        version: string;
        warnings?: string[];
    }>;
}
