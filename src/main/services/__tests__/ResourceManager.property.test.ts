/**
 * ResourceManager 属性测试
 *
 * Feature: electron-cross-platform, Property 11: 平台特定的二进制文件加载
 * Validates: Requirements 3.5
 */

import * as fc from 'fast-check';
import { ResourceManager } from '../ResourceManager';
import * as path from 'path';

describe('ResourceManager Property Tests', () => {
  describe('Property 11: 平台特定的二进制文件加载', () => {
    it('对于任何平台，应该根据 process.platform 返回对应平台的可执行文件路径', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin'),
          fc.constantFrom('x64', 'arm64'),
          (platform: string, arch: string) => {
            // 模拟不同的平台和架构
            const originalPlatform = process.platform;
            const originalArch = process.arch;

            try {
              // 使用 Object.defineProperty 来模拟平台
              Object.defineProperty(process, 'platform', {
                value: platform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: arch,
                writable: true,
                configurable: true,
              });

              const resourceManager = new ResourceManager();
              const singboxPath = resourceManager.getSingBoxPath();

              // 验证路径包含正确的平台目录
              if (platform === 'win32') {
                expect(singboxPath).toContain('win');
                expect(singboxPath).toContain('sing-box.exe');
              } else if (platform === 'darwin') {
                if (arch === 'arm64') {
                  expect(singboxPath).toContain('mac-arm64');
                } else {
                  expect(singboxPath).toContain('mac-x64');
                }
                expect(singboxPath).toContain('sing-box');
                expect(singboxPath).not.toContain('.exe');
              }

              return true;
            } finally {
              // 恢复原始值
              Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true,
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('对于 Windows 平台，应该返回 .exe 扩展名的路径', () => {
      const originalPlatform = process.platform;

      try {
        Object.defineProperty(process, 'platform', {
          value: 'win32',
          writable: true,
          configurable: true,
        });

        const resourceManager = new ResourceManager();
        const singboxPath = resourceManager.getSingBoxPath();

        expect(singboxPath).toMatch(/\.exe$/);
        expect(path.basename(singboxPath)).toBe('sing-box.exe');
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
      }
    });

    it('对于 macOS 平台，应该返回无扩展名的可执行文件路径', () => {
      fc.assert(
        fc.property(fc.constantFrom('x64', 'arm64'), (arch: string) => {
          const originalPlatform = process.platform;
          const originalArch = process.arch;

          try {
            Object.defineProperty(process, 'platform', {
              value: 'darwin',
              writable: true,
              configurable: true,
            });
            Object.defineProperty(process, 'arch', {
              value: arch,
              writable: true,
              configurable: true,
            });

            const resourceManager = new ResourceManager();
            const singboxPath = resourceManager.getSingBoxPath();

            expect(singboxPath).not.toMatch(/\.exe$/);
            expect(path.basename(singboxPath)).toBe('sing-box');

            return true;
          } finally {
            Object.defineProperty(process, 'platform', {
              value: originalPlatform,
              writable: true,
              configurable: true,
            });
            Object.defineProperty(process, 'arch', {
              value: originalArch,
              writable: true,
              configurable: true,
            });
          }
        }),
        { numRuns: 50 }
      );
    });

    it('对于 macOS arm64，应该返回 mac-arm64 目录下的文件', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      try {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          writable: true,
          configurable: true,
        });
        Object.defineProperty(process, 'arch', {
          value: 'arm64',
          writable: true,
          configurable: true,
        });

        const resourceManager = new ResourceManager();
        const singboxPath = resourceManager.getSingBoxPath();

        expect(singboxPath).toContain('mac-arm64');
        expect(singboxPath).not.toContain('mac-x64');
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(process, 'arch', {
          value: originalArch,
          writable: true,
          configurable: true,
        });
      }
    });

    it('对于 macOS x64，应该返回 mac-x64 目录下的文件', () => {
      const originalPlatform = process.platform;
      const originalArch = process.arch;

      try {
        Object.defineProperty(process, 'platform', {
          value: 'darwin',
          writable: true,
          configurable: true,
        });
        Object.defineProperty(process, 'arch', {
          value: 'x64',
          writable: true,
          configurable: true,
        });

        const resourceManager = new ResourceManager();
        const singboxPath = resourceManager.getSingBoxPath();

        expect(singboxPath).toContain('mac-x64');
        expect(singboxPath).not.toContain('mac-arm64');
      } finally {
        Object.defineProperty(process, 'platform', {
          value: originalPlatform,
          writable: true,
          configurable: true,
        });
        Object.defineProperty(process, 'arch', {
          value: originalArch,
          writable: true,
          configurable: true,
        });
      }
    });

    it('应该为不同平台返回正确的应用图标路径', () => {
      fc.assert(
        fc.property(fc.constantFrom('win32', 'darwin'), (platform: string) => {
          const originalPlatform = process.platform;

          try {
            Object.defineProperty(process, 'platform', {
              value: platform,
              writable: true,
              configurable: true,
            });

            const resourceManager = new ResourceManager();
            const iconPath = resourceManager.getAppIconPath();

            if (platform === 'win32') {
              expect(iconPath).toContain('app.ico');
            } else if (platform === 'darwin') {
              expect(iconPath).toContain('app.icns');
            }

            return true;
          } finally {
            Object.defineProperty(process, 'platform', {
              value: originalPlatform,
              writable: true,
              configurable: true,
            });
          }
        }),
        { numRuns: 100 }
      );
    });

    it('应该为所有平台返回相同的 GeoIP/GeoSite 数据文件路径', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin'),
          fc.constantFrom('x64', 'arm64'),
          (platform: string, arch: string) => {
            const originalPlatform = process.platform;
            const originalArch = process.arch;

            try {
              Object.defineProperty(process, 'platform', {
                value: platform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: arch,
                writable: true,
                configurable: true,
              });

              const resourceManager = new ResourceManager();
              const geoipPath = resourceManager.getGeoIPPath();
              const geositeCNPath = resourceManager.getGeoSiteCNPath();
              const geositeNonCNPath = resourceManager.getGeoSiteNonCNPath();

              // 所有平台应该使用相同的数据文件
              expect(geoipPath).toContain('data');
              expect(geoipPath).toContain('geoip-cn.srs');

              expect(geositeCNPath).toContain('data');
              expect(geositeCNPath).toContain('geosite-cn.srs');

              expect(geositeNonCNPath).toContain('data');
              expect(geositeNonCNPath).toContain('geosite-geolocation-!cn.srs');

              return true;
            } finally {
              Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true,
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('getResourceInfo 应该返回正确的平台和架构信息', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('win32', 'darwin'),
          fc.constantFrom('x64', 'arm64'),
          (platform: string, arch: string) => {
            const originalPlatform = process.platform;
            const originalArch = process.arch;

            try {
              Object.defineProperty(process, 'platform', {
                value: platform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: arch,
                writable: true,
                configurable: true,
              });

              const resourceManager = new ResourceManager();
              const info = resourceManager.getResourceInfo();

              expect(info.platform).toBe(platform);
              expect(info.arch).toBe(arch);
              expect(info.singboxPath).toBeTruthy();
              expect(info.geoIPPath).toBeTruthy();
              expect(info.geoSiteCNPath).toBeTruthy();
              expect(info.geoSiteNonCNPath).toBeTruthy();

              return true;
            } finally {
              Object.defineProperty(process, 'platform', {
                value: originalPlatform,
                writable: true,
                configurable: true,
              });
              Object.defineProperty(process, 'arch', {
                value: originalArch,
                writable: true,
                configurable: true,
              });
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
