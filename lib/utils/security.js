"use strict";
/**
 * Security Utilities
 *
 * Provides security-related utility functions including HTML escaping,
 * input validation, and sanitization.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeHtml = escapeHtml;
exports.validateMessageFormat = validateMessageFormat;
exports.sanitizeUserInput = sanitizeUserInput;
exports.validateServerId = validateServerId;
exports.validateUsername = validateUsername;
exports.validateCommand = validateCommand;
exports.generateSecureToken = generateSecureToken;
exports.validateIpAddress = validateIpAddress;
/**
 * 修复问题 #16: HTML 转义函数
 * 防止 XSS 攻击，转义 HTML 特殊字符
 */
function escapeHtml(text) {
    const htmlEscapeMap = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '/': '&#x2F;',
        '`': '&#x60;',
        '=': '&#x3D;'
    };
    return text.replace(/[&<>"'`=\/]/g, (char) => htmlEscapeMap[char] || char);
}
/**
 * 修复问题 #16: 验证消息格式模板
 * 确保模板只包含允许的占位符
 */
function validateMessageFormat(format) {
    // 允许的占位符
    const allowedPlaceholders = [
        '{username}',
        '{content}',
        '{group}',
        '{time}',
        '{server}',
        '{event}',
        '{player}',
        '{message}',
        '{world}',
        '{x}',
        '{y}',
        '{z}'
    ];
    // 检查是否包含潜在危险的内容
    const dangerousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i, // onclick, onload, etc.
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /eval\(/i,
        /expression\(/i
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(format)) {
            return {
                valid: false,
                error: `消息格式包含潜在危险内容: ${pattern.source}`
            };
        }
    }
    // 提取所有占位符
    const placeholderRegex = /\{[^}]+\}/g;
    const placeholders = format.match(placeholderRegex) || [];
    // 检查是否所有占位符都是允许的
    for (const placeholder of placeholders) {
        if (!allowedPlaceholders.includes(placeholder)) {
            return {
                valid: false,
                error: `不允许的占位符: ${placeholder}。允许的占位符: ${allowedPlaceholders.join(', ')}`
            };
        }
    }
    // 转义非占位符部分的 HTML
    let sanitized = format;
    const parts = [];
    let lastIndex = 0;
    for (const match of format.matchAll(placeholderRegex)) {
        // 添加占位符之前的文本（转义）
        if (match.index > lastIndex) {
            parts.push(escapeHtml(format.substring(lastIndex, match.index)));
        }
        // 添加占位符（不转义）
        parts.push(match[0]);
        lastIndex = match.index + match[0].length;
    }
    // 添加最后一部分（转义）
    if (lastIndex < format.length) {
        parts.push(escapeHtml(format.substring(lastIndex)));
    }
    sanitized = parts.join('');
    return {
        valid: true,
        sanitized
    };
}
/**
 * 修复问题 #16: 清理用户输入
 * 移除或转义潜在危险的字符
 */
function sanitizeUserInput(input, options = {}) {
    let sanitized = input;
    // 限制长度
    if (options.maxLength && sanitized.length > options.maxLength) {
        sanitized = sanitized.substring(0, options.maxLength);
    }
    // 移除或转义 HTML
    if (!options.allowHtml) {
        sanitized = escapeHtml(sanitized);
    }
    // 移除换行符
    if (!options.allowNewlines) {
        sanitized = sanitized.replace(/[\r\n]/g, ' ');
    }
    // 移除控制字符（除了空格、制表符、换行符）
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    return sanitized.trim();
}
/**
 * 验证服务器 ID 格式
 * 只允许字母、数字、下划线和连字符
 */
function validateServerId(serverId) {
    if (!serverId || serverId.length === 0) {
        return {
            valid: false,
            error: '服务器 ID 不能为空'
        };
    }
    if (serverId.length > 64) {
        return {
            valid: false,
            error: '服务器 ID 长度不能超过 64 个字符'
        };
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(serverId)) {
        return {
            valid: false,
            error: '服务器 ID 只能包含字母、数字、下划线和连字符'
        };
    }
    return { valid: true };
}
/**
 * 验证用户名格式
 */
function validateUsername(username) {
    if (!username || username.length === 0) {
        return {
            valid: false,
            error: '用户名不能为空'
        };
    }
    if (username.length > 32) {
        return {
            valid: false,
            error: '用户名长度不能超过 32 个字符'
        };
    }
    // 允许中文、字母、数字、下划线
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_]+$/.test(username)) {
        return {
            valid: false,
            error: '用户名只能包含中文、字母、数字和下划线'
        };
    }
    return { valid: true };
}
/**
 * 验证命令格式
 * 防止命令注入
 */
function validateCommand(command) {
    if (!command || command.length === 0) {
        return {
            valid: false,
            error: '命令不能为空'
        };
    }
    if (command.length > 1000) {
        return {
            valid: false,
            error: '命令长度不能超过 1000 个字符'
        };
    }
    // 检查危险字符
    const dangerousChars = ['|', '&', ';', '\n', '\r', '`', '$'];
    for (const char of dangerousChars) {
        if (command.includes(char)) {
            return {
                valid: false,
                error: `命令包含不允许的字符: ${char}`
            };
        }
    }
    // 移除前导斜杠（如果有）
    let sanitized = command.trim();
    if (sanitized.startsWith('/')) {
        sanitized = sanitized.substring(1);
    }
    return {
        valid: true,
        sanitized
    };
}
/**
 * 生成安全的随机令牌
 */
function generateSecureToken(length = 32) {
    const crypto = require('crypto');
    return crypto.randomBytes(length).toString('hex');
}
/**
 * 验证 IP 地址格式
 */
function validateIpAddress(ip) {
    // IPv4 正则
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 正则（简化版）
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
    if (ipv4Regex.test(ip)) {
        // 验证每个数字在 0-255 范围内
        const parts = ip.split('.');
        for (const part of parts) {
            const num = parseInt(part, 10);
            if (num < 0 || num > 255) {
                return {
                    valid: false,
                    error: `无效的 IPv4 地址: ${ip}`
                };
            }
        }
        return { valid: true, type: 'ipv4' };
    }
    if (ipv6Regex.test(ip)) {
        return { valid: true, type: 'ipv6' };
    }
    return {
        valid: false,
        error: `无效的 IP 地址格式: ${ip}`
    };
}
