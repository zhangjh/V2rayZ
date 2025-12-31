#!/usr/bin/env node

/**
 * 推送 Release Tag 脚本
 * 读取 package.json 版本号，创建并推送 tag 触发 GitHub Actions 构建
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = colors.reset) {
  console.log(`${color}${msg}${colors.reset}`);
}

function exec(cmd, silent = false) {
  return execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
}

function execSilent(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function main() {
  const skipConfirm = process.argv.includes('-y') || process.argv.includes('--yes');
  // 使用 -u/--update 替代 -f/--force，因为 npm 会拦截 -f
  const forceUpdate = process.argv.includes('-u') || process.argv.includes('--update');

  if (process.argv.includes('-h') || process.argv.includes('--help')) {
    console.log(`
推送 Release Tag 脚本

用法: node push-release.js [选项]
      npm run release:tag -- [选项]

选项:
  -y, --yes      跳过确认
  -u, --update   强制更新已存在的 tag
  -h, --help     显示帮助

示例:
  npm run release:tag           # 创建并推送 tag
  npm run release:tag -- -u     # 强制更新已存在的 tag
  npm run release:tag -- -y -u  # 跳过确认并强制更新
`);
    process.exit(0);
  }

  log('\n🏷️  Push Release Tag\n', colors.cyan);

  // 读取版本号
  const pkgPath = path.join(__dirname, '../package.json');
  const { version } = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const tag = `v${version}`;

  // 检查未提交更改
  const status = execSilent('git status --porcelain');
  if (status) {
    log('⚠️  存在未提交的更改:', colors.yellow);
    console.log(status);
    const answer = await prompt('是否继续? (y/N): ');
    if (answer !== 'y') {
      log('已取消', colors.yellow);
      process.exit(0);
    }
  }

  // 检查 tag 是否存在
  const localTagExists = execSilent(`git tag -l "${tag}"`) === tag;
  const remoteTagExists = !!execSilent(`git ls-remote --tags origin refs/tags/${tag}`);

  log(`版本: ${version}`, colors.blue);
  log(`Tag:  ${tag}`, colors.blue);
  log(`本地: ${localTagExists ? '存在' : '不存在'}`, localTagExists ? colors.yellow : colors.green);
  log(`远程: ${remoteTagExists ? '存在' : '不存在'}`, remoteTagExists ? colors.yellow : colors.green);
  console.log('');

  if (remoteTagExists && !forceUpdate) {
    log(`❌ Tag ${tag} 已存在于远程`, colors.red);
    log('使用 -u 强制更新，或修改 package.json 版本号', colors.yellow);
    process.exit(1);
  }

  if (!skipConfirm) {
    const action = remoteTagExists ? '强制更新' : '创建并推送';
    const answer = await prompt(`${action} tag ${tag}? (y/N): `);
    if (answer !== 'y') {
      log('已取消', colors.yellow);
      process.exit(0);
    }
  }

  console.log('');

  // 删除已存在的 tag
  if (forceUpdate) {
    if (remoteTagExists) {
      log(`删除远程 tag ${tag}...`, colors.blue);
      exec(`git push origin :refs/tags/${tag}`);
    }
    if (localTagExists) {
      log(`删除本地 tag ${tag}...`, colors.blue);
      exec(`git tag -d ${tag}`, true);
    }
  }

  // 创建 tag
  if (!localTagExists || forceUpdate) {
    log(`创建 tag ${tag}...`, colors.blue);
    exec(`git tag -a ${tag} -m "Release ${version}"`, true);
  }

  // 推送 tag
  log(`推送 tag ${tag}...`, colors.blue);
  exec(`git push origin ${tag}`);

  console.log('');
  log('✅ Tag 推送成功，GitHub Actions 将自动构建', colors.green);
  log(`🔗 https://github.com/zhangjh/FlowZ/actions`, colors.blue);
}

main().catch((err) => {
  log(`❌ ${err.message}`, colors.red);
  process.exit(1);
});
