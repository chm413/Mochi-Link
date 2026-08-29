"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveRuntimeVersion = resolveRuntimeVersion;
exports.getLegacyModeWindows = getLegacyModeWindows;
exports.formatLegacyModeWindowNotice = formatLegacyModeWindowNotice;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const FALLBACK_VERSION = '1.7.0';
function parseSemver(version) {
    const normalized = version.trim().replace(/^v/i, '');
    const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);
    if (!match) {
        return { major: 1, minor: 7, patch: 0 };
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3])
    };
}
function readPackageVersion() {
    try {
        const packageJsonPath = (0, node_path_1.join)(__dirname, '..', '..', 'package.json');
        if (!(0, node_fs_1.existsSync)(packageJsonPath)) {
            return undefined;
        }
        const packageJsonRaw = (0, node_fs_1.readFileSync)(packageJsonPath, 'utf-8');
        const packageJson = JSON.parse(packageJsonRaw);
        return packageJson.version;
    }
    catch {
        return undefined;
    }
}
function resolveRuntimeVersion() {
    return process.env.MOCHI_LINK_VERSION
        || process.env.npm_package_version
        || readPackageVersion()
        || FALLBACK_VERSION;
}
function getLegacyModeWindows(version = resolveRuntimeVersion()) {
    const parsed = parseSemver(version);
    const removeMinor = parsed.minor + 1;
    return {
        runtimeVersion: `${parsed.major}.${parsed.minor}.${parsed.patch}`,
        compatWindow: `v${parsed.major}.${parsed.minor}.x（兼容期）`,
        removeWindow: `v${parsed.major}.${removeMinor}.0（下一主/次版本移除）`
    };
}
function formatLegacyModeWindowNotice(version = resolveRuntimeVersion()) {
    const windows = getLegacyModeWindows(version);
    return `版本窗口：${windows.compatWindow} 继续兼容读取旧值并告警；${windows.removeWindow} 将彻底移除旧值读取。`;
}
