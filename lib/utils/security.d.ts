/**
 * Security Utilities
 *
 * Provides security-related utility functions including HTML escaping,
 * input validation, and sanitization.
 */
/**
 * 修复问题 #16: HTML 转义函数
 * 防止 XSS 攻击，转义 HTML 特殊字符
 */
export declare function escapeHtml(text: string): string;
/**
 * 修复问题 #16: 验证消息格式模板
 * 确保模板只包含允许的占位符
 */
export declare function validateMessageFormat(format: string): {
    valid: boolean;
    error?: string;
    sanitized?: string;
};
/**
 * 修复问题 #16: 清理用户输入
 * 移除或转义潜在危险的字符
 */
export declare function sanitizeUserInput(input: string, options?: {
    maxLength?: number;
    allowHtml?: boolean;
    allowNewlines?: boolean;
}): string;
/**
 * 验证服务器 ID 格式
 * 只允许字母、数字、下划线和连字符
 */
export declare function validateServerId(serverId: string): {
    valid: boolean;
    error?: string;
};
/**
 * 验证用户名格式
 */
export declare function validateUsername(username: string): {
    valid: boolean;
    error?: string;
};
/**
 * 验证命令格式
 * 防止命令注入
 */
export declare function validateCommand(command: string): {
    valid: boolean;
    error?: string;
    sanitized?: string;
};
/**
 * 生成安全的随机令牌
 */
export declare function generateSecureToken(length?: number): string;
/**
 * 验证 IP 地址格式
 */
export declare function validateIpAddress(ip: string): {
    valid: boolean;
    error?: string;
    type?: 'ipv4' | 'ipv6';
};
