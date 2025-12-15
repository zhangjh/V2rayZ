#!/usr/bin/env node

/**
 * V2rayZ 自动发布脚本
 * 功能：
 * 1. 从 package.json 读取版本号
 * 2. 创建 Git tag 并推送
 * 3. 使用 GitHub CLI 创建 Release
 * 4. 上传安装包产物 (.exe, .dmg)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// 配置
const CONFIG = {
  repoOwner: 'zhangjh',
  repoName: 'V2rayZ',
  distDir: path.join(__dirname, '../dist-package'),
  // 只上传安装包，不上传 zip
  allowedExtensions: ['.exe', '.dmg'],
};

// 命令行参数
const args = {
  preRelease: process.argv.includes('--pre-release') || process.argv.includes('-p'),
  draft: process.argv.includes('--draft') || process.argv.includes('-d'),
  skipConfirm: process.argv.includes('--yes') || process.argv.includes('-y'),
  skipTag: process.argv.includes('--skip-tag'),
  help: process.argv.includes('--help') || process.argv.includes('-h'),
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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

function showHelp() {
  console.log(`
V2rayZ 自动发布脚本

用法: node auto-release.js [选项]

选项:
  -p, --pre-release  创建预发布版本
  -d, --draft        创建草稿版本
  -y, --yes          跳过确认提示
  --skip-tag         跳过 Git 标签创建（标签已存在时使用）
  -h, --help         显示帮助信息

示例:
  npm run release              # 正式发布
  npm run release -- -p        # 预发布
  npm run release -- -d        # 草稿
  npm run release -- --skip-tag  # 标签已存在时
`);
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

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// 检查 GitHub CLI
function checkGitHubCLI() {
  try {
    exec('gh --version', { silent: true });
    return true;
  } catch {
    return false;
  }
}

// 检查 GitHub CLI 认证状态
function checkGitHubAuth() {
  try {
    exec('gh auth status', { silent: true });
    return true;
  } catch {
    return false;
  }
}

// 检查 Git 仓库
function checkGitRepo() {
  try {
    exec('git rev-parse --git-dir', { silent: true });
    return true;
  } catch {
    return false;
  }
}

// 检查未提交更改
function checkUncommittedChanges() {
  const status = exec('git status --porcelain', { silent: true });
  return status && status.trim().length > 0;
}

// 读取版本号
function getVersion() {
  const packageJsonPath = path.join(__dirname, '../package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
  return packageJson.version;
}

// 检查 tag 是否存在
function tagExists(tag) {
  const result = exec(`git tag -l "${tag}"`, { silent: true });
  return result && result.trim() === tag;
}

// 检查远程 tag 是否存在
function remoteTagExists(tag) {
  const result = exec(`git ls-remote --tags origin refs/tags/${tag}`, { silent: true, ignoreError: true });
  return result && result.includes(tag);
}

// 创建 Git tag
function createTag(version) {
  const tag = `v${version}`;

  if (args.skipTag) {
    info(`跳过标签创建 (--skip-tag)`);
    return tag;
  }

  if (tagExists(tag)) {
    if (remoteTagExists(tag)) {
      warning(`Tag ${tag} 已存在于本地和远程`);
      return tag;
    }
    info(`Tag ${tag} 存在于本地，推送到远程...`);
  } else {
    info(`创建 tag: ${tag}`);
    exec(`git tag -a ${tag} -m "Release ${version}"`);
    success(`Tag ${tag} 创建成功`);
  }

  return tag;
}

// 推送 tag
function pushTag(tag) {
  if (args.skipTag && remoteTagExists(tag)) {
    info(`Tag ${tag} 已存在于远程，跳过推送`);
    return;
  }

  info(`推送 tag ${tag} 到远程仓库...`);
  exec(`git push origin ${tag}`);
  success(`Tag ${tag} 推送成功`);
}

// 生成 Release Notes
function generateReleaseNotes(version) {
  const changelogPath = path.join(__dirname, '../CHANGELOG.md');
  
  if (fs.existsSync(changelogPath)) {
    const changelog = fs.readFileSync(changelogPath, 'utf-8');
    const versionRegex = new RegExp(`## \\[?${version}\\]?[\\s\\S]*?(?=## |$)`, 'i');
    const match = changelog.match(versionRegex);
    if (match) {
      return match[0];
    }
  }

  // 从 Git commits 生成
  try {
    const lastTag = exec('git describe --tags --abbrev=0 HEAD^', {
      silent: true,
      ignoreError: true,
    });

    let commits;
    if (lastTag && lastTag.trim()) {
      commits = exec(`git log ${lastTag.trim()}..HEAD --pretty=format:"- %s"`, { silent: true });
    } else {
      commits = exec('git log -20 --pretty=format:"- %s"', { silent: true });
    }

    return `## V2rayZ v${version}

### 更新内容
${commits || '- 性能优化和错误修复'}

### 下载说明
- Windows: 下载 \`.exe\` 安装包
- macOS Intel: 下载 \`mac-x64.dmg\`
- macOS Apple Silicon: 下载 \`mac-arm64.dmg\`

### 系统要求
- Windows 10 (1809+) 或 Windows 11
- macOS 10.15+ (Catalina 或更高版本)
`;
  } catch {
    return `## V2rayZ v${version}\n\n性能优化和错误修复。`;
  }
}

// 查找打包产物
function findArtifacts() {
  if (!fs.existsSync(CONFIG.distDir)) {
    return [];
  }

  const files = fs.readdirSync(CONFIG.distDir);
  return files
    .filter((f) => CONFIG.allowedExtensions.some((ext) => f.endsWith(ext)))
    .map((f) => path.join(CONFIG.distDir, f));
}

// 检查 Release 是否已存在
function releaseExists(tag) {
  const result = exec(`gh release view ${tag}`, { silent: true, ignoreError: true });
  return result !== null;
}

// 创建 GitHub Release
function createGitHubRelease(tag, version, releaseNotes, artifacts) {
  info(`创建 GitHub Release: ${tag}`);

  // 检查是否已存在
  if (releaseExists(tag)) {
    warning(`Release ${tag} 已存在`);
    info('如需更新，请先删除: gh release delete ' + tag);
    return false;
  }

  const notesFile = path.join(__dirname, '../.release-notes.tmp');
  fs.writeFileSync(notesFile, releaseNotes);

  try {
    let command = `gh release create ${tag} --title "V2rayZ v${version}" --notes-file "${notesFile}"`;

    if (args.preRelease) {
      command += ' --prerelease';
    }
    if (args.draft) {
      command += ' --draft';
    }

    // 添加产物文件
    if (artifacts.length > 0) {
      info(`上传 ${artifacts.length} 个安装包...`);
      artifacts.forEach((artifact) => {
        const basename = path.basename(artifact);
        info(`  - ${basename}`);
        command += ` "${artifact}"`;
      });
    }

    exec(command);
    success(`GitHub Release ${tag} 创建成功`);
    return true;
  } finally {
    if (fs.existsSync(notesFile)) {
      fs.unlinkSync(notesFile);
    }
  }
}

// 主函数
async function main() {
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  log('\n🚀 V2rayZ 自动发布\n', colors.bright + colors.cyan);

  // 环境检查
  info('检查环境...');

  if (!checkGitRepo()) {
    error('当前目录不是 Git 仓库');
    process.exit(1);
  }

  if (!checkGitHubCLI()) {
    error('未安装 GitHub CLI (gh)');
    error('安装: https://cli.github.com/');
    process.exit(1);
  }

  if (!checkGitHubAuth()) {
    error('GitHub CLI 未认证');
    error('运行: gh auth login');
    process.exit(1);
  }

  success('环境检查通过');

  // 检查未提交更改
  if (checkUncommittedChanges()) {
    warning('存在未提交的更改');
  }

  // 获取版本
  const version = getVersion();
  const tag = `v${version}`;

  // 查找产物
  const artifacts = findArtifacts();

  // 显示发布信息
  console.log('');
  log('┌─────────────────────────────────────┐', colors.cyan);
  log('│           发布信息                  │', colors.cyan);
  log('├─────────────────────────────────────┤', colors.cyan);
  log(`│  版本: ${version.padEnd(28)}│`, colors.cyan);
  log(`│  标签: ${tag.padEnd(28)}│`, colors.cyan);
  log(`│  类型: ${(args.preRelease ? '预发布' : args.draft ? '草稿' : '正式发布').padEnd(28)}│`, colors.cyan);
  log(`│  产物: ${(artifacts.length + ' 个文件').padEnd(28)}│`, colors.cyan);
  log('└─────────────────────────────────────┘', colors.cyan);
  console.log('');

  if (artifacts.length > 0) {
    info('将上传以下文件:');
    artifacts.forEach((a) => info(`  - ${path.basename(a)}`));
  } else {
    warning('未找到打包产物');
    warning('请先运行: npm run package:all');
  }

  console.log('');

  // 确认
  if (!args.skipConfirm) {
    const answer = await prompt('确认发布? (y/N): ');
    if (answer !== 'y' && answer !== 'yes') {
      info('已取消发布');
      process.exit(0);
    }
  }

  console.log('');

  // 创建并推送 tag
  createTag(version);
  pushTag(tag);

  // 生成 Release Notes
  info('生成 Release Notes...');
  const releaseNotes = generateReleaseNotes(version);

  // 创建 Release
  const created = createGitHubRelease(tag, version, releaseNotes, artifacts);

  if (created) {
    console.log('');
    log('✨ 发布完成！', colors.bright + colors.green);
    log(`🔗 https://github.com/${CONFIG.repoOwner}/${CONFIG.repoName}/releases/tag/${tag}`, colors.blue);
    
    if (args.draft) {
      warning('注意: Release 为草稿状态，需要手动发布');
    }
  }

  console.log('');
}

main().catch((err) => {
  error(`发布失败: ${err.message}`);
  process.exit(1);
});
