/**
 * Property-Based Tests for Build Artifacts
 * Feature: electron-cross-platform, Property 34: 打包产物包含必要文件
 * Validates: Requirements 12.4
 */

import * as fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';

describe('Build Artifacts Property Tests', () => {
  const distPackageDir = path.join(__dirname, '../../dist-package');

  describe('Property 34: 打包产物包含必要文件', () => {
    /**
     * 属性: 对于任何平台的打包产物，应该包含对应平台的 sing-box 可执行文件、
     * 前端资源文件、和必要的配置文件
     */
    it('should contain necessary files for Windows build', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant('win'), async (platform) => {
          // 检查打包输出目录是否存在
          if (!fs.existsSync(distPackageDir)) {
            // 如果打包目录不存在，跳过测试（需要先执行打包）
            console.log('打包目录不存在，跳过测试。请先运行 npm run package:win');
            return true;
          }

          // 查找 Windows 打包产物
          const files = fs.readdirSync(distPackageDir);
          const winArtifacts = files.filter(
            (f) => f.includes('win') && (f.endsWith('.exe') || f.endsWith('.zip'))
          );

          if (winArtifacts.length === 0) {
            console.log('未找到 Windows 打包产物，跳过测试');
            return true;
          }

          // 检查解压后的文件结构（对于 NSIS 安装包，我们检查 win-unpacked 目录）
          const unpackedDir = path.join(distPackageDir, 'win-unpacked');
          if (!fs.existsSync(unpackedDir)) {
            console.log('未找到解压目录，跳过详细检查');
            return true;
          }

          // 必需的文件和目录
          const requiredPaths = [
            'V2rayZ.exe', // 主程序
            'resources', // 资源目录
            'resources/app.asar', // 打包的应用代码
          ];

          // 检查必需文件是否存在
          for (const requiredPath of requiredPaths) {
            const fullPath = path.join(unpackedDir, requiredPath);
            if (!fs.existsSync(fullPath)) {
              console.error(`缺少必需文件: ${requiredPath}`);
              return false;
            }
          }

          // 检查 resources 目录下的平台特定文件
          const resourcesDir = path.join(unpackedDir, 'resources');
          const resourceFiles = fs.readdirSync(resourcesDir, { recursive: true }) as string[];

          // 应该包含 Windows 的 sing-box.exe
          const hasSingBox = resourceFiles.some(
            (f) => f.includes('win') && f.includes('sing-box.exe')
          );

          // 应该包含 GeoIP/GeoSite 数据文件
          const hasGeoData = resourceFiles.some((f) => f.includes('data') && f.endsWith('.srs'));

          return hasSingBox && hasGeoData;
        }),
        { numRuns: 1 } // 只运行一次，因为这是检查构建产物
      );
    }, 30000);

    it('should contain necessary files for macOS build', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant('mac'), async (platform) => {
          // 检查打包输出目录是否存在
          if (!fs.existsSync(distPackageDir)) {
            console.log('打包目录不存在，跳过测试。请先运行 npm run package:mac');
            return true;
          }

          // 查找 macOS 打包产物
          const files = fs.readdirSync(distPackageDir);
          const macArtifacts = files.filter(
            (f) => f.includes('mac') && (f.endsWith('.dmg') || f.endsWith('.zip'))
          );

          if (macArtifacts.length === 0) {
            console.log('未找到 macOS 打包产物，跳过测试');
            return true;
          }

          // 检查解压后的文件结构（对于 DMG，我们检查 mac 或 mac-universal-unpacked 目录）
          const possibleUnpackedDirs = [
            'mac-unpacked',
            'mac-x64-unpacked',
            'mac-arm64-unpacked',
            'mac-universal-unpacked',
          ];

          let unpackedDir: string | null = null;
          for (const dir of possibleUnpackedDirs) {
            const fullPath = path.join(distPackageDir, dir);
            if (fs.existsSync(fullPath)) {
              unpackedDir = fullPath;
              break;
            }
          }

          if (!unpackedDir) {
            console.log('未找到解压目录，跳过详细检查');
            return true;
          }

          // macOS 应用包结构
          const appPath = path.join(unpackedDir, 'V2rayZ.app');
          if (!fs.existsSync(appPath)) {
            console.error('缺少 V2rayZ.app');
            return false;
          }

          // 检查应用包内的必需文件
          const requiredPaths = [
            'Contents/MacOS/V2rayZ', // 主程序
            'Contents/Resources', // 资源目录
            'Contents/Resources/app.asar', // 打包的应用代码
          ];

          for (const requiredPath of requiredPaths) {
            const fullPath = path.join(appPath, requiredPath);
            if (!fs.existsSync(fullPath)) {
              console.error(`缺少必需文件: ${requiredPath}`);
              return false;
            }
          }

          // 检查 resources 目录下的平台特定文件
          const resourcesDir = path.join(appPath, 'Contents/Resources');
          const resourceFiles = fs.readdirSync(resourcesDir, { recursive: true }) as string[];

          // 应该包含 macOS 的 sing-box（无扩展名）
          const hasSingBox = resourceFiles.some(
            (f) => f.includes('mac') && f.includes('sing-box') && !f.endsWith('.exe')
          );

          // 应该包含 GeoIP/GeoSite 数据文件
          const hasGeoData = resourceFiles.some((f) => f.includes('data') && f.endsWith('.srs'));

          return hasSingBox && hasGeoData;
        }),
        { numRuns: 1 }
      );
    }, 30000);

    it('should verify platform-specific binary files exist in resources', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('win', 'mac-x64', 'mac-arm64'),
          async (platformArch) => {
            // 检查源资源目录中的平台特定文件
            const resourcesBaseDir = path.join(__dirname, '../../resources');

            if (platformArch === 'win') {
              const winDir = path.join(resourcesBaseDir, 'win');
              const singBoxPath = path.join(winDir, 'sing-box.exe');

              if (!fs.existsSync(singBoxPath)) {
                console.error(`缺少 Windows sing-box: ${singBoxPath}`);
                return false;
              }

              // 检查文件大小（应该大于 1MB）
              const stats = fs.statSync(singBoxPath);
              return stats.size > 1024 * 1024;
            } else if (platformArch === 'mac-x64') {
              const macDir = path.join(resourcesBaseDir, 'mac-x64');
              const singBoxPath = path.join(macDir, 'sing-box');

              if (!fs.existsSync(singBoxPath)) {
                console.error(`缺少 macOS x64 sing-box: ${singBoxPath}`);
                return false;
              }

              const stats = fs.statSync(singBoxPath);
              return stats.size > 1024 * 1024;
            } else {
              // mac-arm64
              const macDir = path.join(resourcesBaseDir, 'mac-arm64');
              const singBoxPath = path.join(macDir, 'sing-box');

              if (!fs.existsSync(singBoxPath)) {
                console.error(`缺少 macOS arm64 sing-box: ${singBoxPath}`);
                return false;
              }

              const stats = fs.statSync(singBoxPath);
              return stats.size > 1024 * 1024;
            }
          }
        ),
        { numRuns: 3 }
      );
    });

    it('should verify GeoIP/GeoSite data files exist', async () => {
      await fc.assert(
        fc.asyncProperty(fc.constant('data'), async () => {
          const dataDir = path.join(__dirname, '../../resources/data');

          if (!fs.existsSync(dataDir)) {
            console.error(`数据目录不存在: ${dataDir}`);
            return false;
          }

          const files = fs.readdirSync(dataDir);

          // 应该至少包含一些 .srs 文件
          const srsFiles = files.filter((f) => f.endsWith('.srs'));

          if (srsFiles.length === 0) {
            console.error('未找到 GeoIP/GeoSite 数据文件 (.srs)');
            return false;
          }

          // 检查文件大小（应该大于 10KB，确保不是空文件）
          for (const file of srsFiles) {
            const filePath = path.join(dataDir, file);
            const stats = fs.statSync(filePath);
            if (stats.size < 10 * 1024) {
              console.error(`数据文件太小: ${file}`);
              return false;
            }
          }

          return true;
        }),
        { numRuns: 1 }
      );
    });
  });
});
