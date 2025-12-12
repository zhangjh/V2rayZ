const { spawn } = require('child_process');
const { createServer } = require('vite');
const path = require('path');
const waitOn = require('wait-on');

async function startDev() {
  console.log('🚀 启动开发环境...\n');

  // 1. 启动 Vite 开发服务器
  console.log('📦 启动 Vite 开发服务器...');
  const viteServer = await createServer({
    configFile: path.join(__dirname, '../vite.config.ts'),
    mode: 'development',
  });
  await viteServer.listen();
  console.log('✅ Vite 开发服务器已启动\n');

  // 2. 等待 Vite 服务器就绪
  console.log('⏳ 等待 Vite 服务器就绪...');
  await waitOn({
    resources: ['http://localhost:5173'],
    timeout: 30000,
  });
  console.log('✅ Vite 服务器就绪\n');

  // 3. 编译主进程代码
  console.log('🔨 编译主进程代码...');
  const tsc = spawn('npx', ['tsc', '-p', 'tsconfig.main.json'], {
    shell: true,
    stdio: 'inherit',
  });

  await new Promise((resolve, reject) => {
    tsc.on('close', (code) => {
      if (code === 0) {
        console.log('✅ 主进程代码编译完成\n');
        resolve();
      } else {
        reject(new Error(`TypeScript 编译失败，退出码: ${code}`));
      }
    });
  });

  // 4. 启动 Electron
  console.log('⚡ 启动 Electron...\n');
  const electron = spawn('npx', ['electron', '.'], {
    shell: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
  });

  electron.on('close', () => {
    console.log('\n👋 Electron 已关闭');
    viteServer.close();
    process.exit(0);
  });
}

startDev().catch((err) => {
  console.error('❌ 启动失败:', err);
  process.exit(1);
});
