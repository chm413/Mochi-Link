export declare function resolveRuntimeVersion(): string;
export declare function getLegacyModeWindows(version?: string): {
    runtimeVersion: string;
    compatWindow: string;
    removeWindow: string;
};
export declare function formatLegacyModeWindowNotice(version?: string): string;
