/**
 * 路径工具函数
 * 确保在任何权限上下文中都能获取正确的用户数据路径
 */

import { app } from 'electron';
import * as path from 'path';

/**
 * 缓存的用户数据路径（在应用启动时以普通用户身份运行时确定）
 */
let cachedUserDataPath: string | null = null;

/**
 * 获取正确的用户数据路径
 * 解决以 root 权限运行时 app.getPath('userData') 返回 /var/root/... 的问题
 *
 * 在 macOS 上，当应用以 root 权限运行时：
 * - app.getPath('userData') 返回 /var/root/Library/Application Support/FlowZ
 * - 但我们需要的是 /Users/<actual_user>/Library/Application Support/FlowZ
 *
 * 策略：
 * 1. 如果已缓存路径，直接返回
 * 2. 检查是否以 root 运行，如果是则尝试获取真实用户的路径
 * 3. 否则使用 Electron 的默认路径
 */
export function getUserDataPath(): string {
    if (cachedUserDataPath) {
        return cachedUserDataPath;
    }

    // 获取 Electron 默认的 userData 路径
    let userDataPath = app.getPath('userData');

    // 检查是否在 macOS 上以 root 运行
    if (process.platform === 'darwin' && process.getuid && process.getuid() === 0) {
        // 尝试从环境变量获取真实用户
        const sudoUser = process.env.SUDO_USER;
        const homeDir = process.env.HOME;

        if (sudoUser) {
            // 通过 SUDO_USER 构建正确的路径
            const realUserHome = `/Users/${sudoUser}`;
            const appName = app.getName() || 'FlowZ';
            userDataPath = path.join(realUserHome, 'Library/Application Support', appName);
        } else if (homeDir && homeDir.startsWith('/Users/')) {
            // 通过 HOME 环境变量获取
            const appName = app.getName() || 'FlowZ';
            // 提取用户名
            const match = homeDir.match(/^\/Users\/([^\/]+)/);
            if (match) {
                userDataPath = path.join('/Users', match[1], 'Library/Application Support', appName);
            }
        }
    }

    // 缓存路径
    cachedUserDataPath = userDataPath;

    return userDataPath;
}

/**
 * 设置用户数据路径（应在应用启动时以普通用户身份调用）
 * 这确保即使后来以 root 运行部分代码，也能使用正确的路径
 */
export function initUserDataPath(): void {
    if (!cachedUserDataPath) {
        // 在应用启动时（普通用户身份）缓存路径
        cachedUserDataPath = app.getPath('userData');
        console.log('[Paths] User data path initialized:', cachedUserDataPath);
    }
}

/**
 * 获取配置文件路径
 */
export function getConfigPath(): string {
    return path.join(getUserDataPath(), 'config.json');
}

/**
 * 获取 sing-box 配置文件路径
 */
export function getSingBoxConfigPath(): string {
    return path.join(getUserDataPath(), 'singbox_config.json');
}

/**
 * 获取 sing-box 日志文件路径
 */
export function getSingBoxLogPath(): string {
    return path.join(getUserDataPath(), 'singbox.log');
}

/**
 * 获取 sing-box PID 文件路径
 */
export function getSingBoxPidPath(): string {
    return path.join(getUserDataPath(), 'singbox.pid');
}

/**
 * 获取缓存数据库路径
 */
export function getCachePath(): string {
    return path.join(getUserDataPath(), 'cache.db');
}

/**
 * 获取日志目录路径
 */
export function getLogsPath(): string {
    return path.join(getUserDataPath(), 'logs');
}
