#!/usr/bin/env node

/**
 * 自动发布脚本
 * 功能：
 * 1. 从 package.json 读取版本号
 * 2. 创建 Git tag
 * 3. 推送 tag 到远程仓库
 * 4. 使用 GitHub CLI 创建 Release
 * 5. 上传所有打包产物
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warning(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

function exec(command, options = {}) {
  try {
    return execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      ...options,
    });
  } catch (err) {
    if (!options.ignoreError) {
      throw err;
    }
    return null;
  }
}

// 检查 GitHub CLI 是否安装
function checkGitHubCLI() {
  try {
    exec('gh --version', { silent: true });
    return true;
  } catch {
    return false;
  }
}

// 检查是否在 Git 仓库中
function checkGitRepo() {
  try {
    exec('git rev-parse --git-dir', { silent: true });
    return true;
  } catch {
    return false;
  }
}

// 检查是否有未提交的更改
function checkUncommittedChanges() {
  const status = exec('git status --porcelain', { silent: true });
  return status && status.trim().length > 0;
}

// 读取 package.json 获取版本号
function getVersion() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

// 检查 tag 是否已存在
function tagExists(tag) {
  try {
    exec(`git rev-parse ${tag}`, { silent: true, ignoreError: true });
    return true;
  } catch {
    return false;
  }
}

// 创建 Git tag
function createTag(version) {
  const tag = `v${version}`;

  if (tagExists(tag)) {
    warning(`Tag ${tag} 已存在`);
    return tag;
  }

  info(`创建 tag: ${tag}`);
  exec(`git tag -a ${tag} -m "Release ${version}"`);
  success(`Tag ${tag} 创建成功`);

  return tag;
}

// 推送 tag 到远程仓库
function pushTag(tag) {
  info(`推送 tag ${tag} 到远程仓库...`);
  exec(`git push origin ${tag}`);
  success(`Tag ${tag} 推送成功`);
}

// 生成 Release Notes
function generateReleaseNotes(version) {
  // 尝试从 CHANGELOG.md 读取
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf-8');
    // 提取当前版本的更新内容
    const versionRegex = new RegExp(`## \\[?${version}\\]?[\\s\\S]*?(?=## |$)`, 'i');
    const match = changelog.match(versionRegex);
    if (match) {
      return match[0];
    }
  }

  // 如果没有 CHANGELOG，从 Git commits 生成
  info('从 Git commits 生成 Release Notes...');
  try {
    const lastTag = exec('git describe --tags --abbrev=0 HEAD^', {
      silent: true,
      ignoreError: true,
    });

    if (lastTag) {
      const commits = exec(`git log ${lastTag.trim()}..HEAD --pretty=format:"- %s"`, {
        silent: true,
      });
      return `## What's Changed\n\n${commits}`;
    } else {
      const commits = exec('git log --pretty=format:"- %s"', { silent: true });
      return `## What's Changed\n\n${commits}`;
    }
  } catch {
    return `## Release ${version}\n\nNo changelog available.`;
  }
}

// 查找打包产物
function findArtifacts() {
  const distDir = path.join(__dirname, '../dist-package');

  if (!fs.existsSync(distDir)) {
    error('打包目录不存在，请先运行打包命令');
    return [];
  }

  const files = fs.readdirSync(distDir);
  const artifacts = files.filter(
    (f) =>
      f.endsWith('.exe') ||
      f.endsWith('.dmg') ||
      f.endsWith('.zip') ||
      f.endsWith('.AppImage') ||
      f.endsWith('.deb')
  );

  return artifacts.map((f) => path.join(distDir, f));
}

// 创建 GitHub Release
function createGitHubRelease(tag, version, releaseNotes, artifacts) {
  info(`创建 GitHub Release: ${tag}`);

  // 保存 Release Notes 到临时文件
  const notesFile = path.join(__dirname, '../.release-notes.tmp');
  fs.writeFileSync(notesFile, releaseNotes);

  try {
    // 构建 gh release create 命令
    let command = `gh release create ${tag} --title "Release ${version}" --notes-file "${notesFile}"`;

    // 添加所有产物文件
    if (artifacts.length > 0) {
      info(`上传 ${artifacts.length} 个文件...`);
      artifacts.forEach((artifact) => {
        command += ` "${artifact}"`;
      });
    }

    exec(command);
    success(`GitHub Release ${tag} 创建成功`);
  } finally {
    // 清理临时文件
    if (fs.existsSync(notesFile)) {
      fs.unlinkSync(notesFile);
    }
  }
}

// 主函数
async function main() {
  log('\n🚀 开始自动发布流程...\n', colors.bright);

  // 1. 检查环境
  info('检查环境...');

  if (!checkGitRepo()) {
    error('当前目录不是 Git 仓库');
    process.exit(1);
  }

  if (!checkGitHubCLI()) {
    error('未安装 GitHub CLI (gh)');
    error('请访问 https://cli.github.com/ 安装');
    process.exit(1);
  }

  if (checkUncommittedChanges()) {
    warning('存在未提交的更改');
    const answer = exec('echo "是否继续? (y/N): " && read answer && echo $answer', {
      silent: true,
      ignoreError: true,
    });
    if (!answer || answer.trim().toLowerCase() !== 'y') {
      info('已取消发布');
      process.exit(0);
    }
  }

  // 2. 获取版本号
  const version = getVersion();
  success(`当前版本: ${version}`);

  // 3. 创建并推送 tag
  const tag = createTag(version);
  pushTag(tag);

  // 4. 生成 Release Notes
  info('生成 Release Notes...');
  const releaseNotes = generateReleaseNotes(version);

  // 5. 查找打包产物
  info('查找打包产物...');
  const artifacts = findArtifacts();

  if (artifacts.length === 0) {
    warning('未找到打包产物');
    warning('请先运行: npm run package:all');
  } else {
    success(`找到 ${artifacts.length} 个打包产物:`);
    artifacts.forEach((artifact) => {
      info(`  - ${path.basename(artifact)}`);
    });
  }

  // 6. 创建 GitHub Release
  createGitHubRelease(tag, version, releaseNotes, artifacts);

  log('\n✨ 发布完成！\n', colors.bright + colors.green);
}

// 运行主函数
main().catch((err) => {
  error(`发布失败: ${err.message}`);
  process.exit(1);
});
