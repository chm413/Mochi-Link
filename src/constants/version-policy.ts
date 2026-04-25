import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const FALLBACK_VERSION = '1.7.0';

interface ParsedVersion {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): ParsedVersion {
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

function readPackageVersion(): string | undefined {
  try {
    const packageJsonPath = join(__dirname, '..', '..', 'package.json');
    if (!existsSync(packageJsonPath)) {
      return undefined;
    }

    const packageJsonRaw = readFileSync(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonRaw) as { version?: string };
    return packageJson.version;
  } catch {
    return undefined;
  }
}

export function resolveRuntimeVersion(): string {
  return process.env.MOCHI_LINK_VERSION
    || process.env.npm_package_version
    || readPackageVersion()
    || FALLBACK_VERSION;
}

export function getLegacyModeWindows(version = resolveRuntimeVersion()): {
  runtimeVersion: string;
  compatWindow: string;
  removeWindow: string;
} {
  const parsed = parseSemver(version);
  const removeMinor = parsed.minor + 1;

  return {
    runtimeVersion: `${parsed.major}.${parsed.minor}.${parsed.patch}`,
    compatWindow: `v${parsed.major}.${parsed.minor}.x（兼容期）`,
    removeWindow: `v${parsed.major}.${removeMinor}.0（下一主/次版本移除）`
  };
}

export function formatLegacyModeWindowNotice(version = resolveRuntimeVersion()): string {
  const windows = getLegacyModeWindows(version);
  return `版本窗口：${windows.compatWindow} 继续兼容读取旧值并告警；${windows.removeWindow} 将彻底移除旧值读取。`;
}
