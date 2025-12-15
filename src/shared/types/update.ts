/**
 * 更新相关类型定义
 */

/**
 * 更新信息
 */
export interface UpdateInfo {
  /** 版本号 */
  version: string;
  /** 发布标题 */
  title: string;
  /** 更新说明 */
  releaseNotes: string;
  /** 下载链接 */
  downloadUrl: string;
  /** 文件大小（字节） */
  fileSize: number;
  /** 发布时间 */
  publishedAt: string;
  /** 是否为预发布版本 */
  isPrerelease: boolean;
  /** 文件名 */
  fileName: string;
}

/**
 * 更新状态
 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'no-update'
  | 'update-available'
  | 'downloading'
  | 'downloaded'
  | 'error';

/**
 * 更新进度
 */
export interface UpdateProgress {
  status: UpdateStatus;
  percentage: number;
  message: string;
  error?: string;
}

/**
 * 更新检查结果
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  updateInfo?: UpdateInfo;
  error?: string;
}
