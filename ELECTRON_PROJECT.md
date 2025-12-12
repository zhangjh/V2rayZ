# V2rayZ Electron 项目

这是 V2rayZ 的 Electron 跨平台版本，支持 Windows 和 macOS。

## 项目结构

```
.
├── src/
│   ├── main/           # 主进程代码（Node.js）
│   │   ├── index.ts    # 主进程入口
│   │   └── preload.ts  # Preload 脚本
│   ├── renderer/       # 渲染进程代码（React）
│   │   ├── index.html  # HTML 入口
│   │   ├── main.tsx    # React 入口
│   │   └── App.tsx     # React 根组件
│   └── shared/         # 共享代码
│       ├── types.ts    # 类型定义
│       └── ipc-channels.ts  # IPC 通道定义
├── resources/          # 平台特定资源
│   ├── win/           # Windows 资源
│   ├── mac-x64/       # macOS Intel 资源
│   ├── mac-arm64/     # macOS Apple Silicon 资源
│   └── data/          # 共享数据文件
├── build/             # 构建资源（图标等）
├── scripts/           # 构建和开发脚本
├── dist/              # 编译输出
└── release/           # 打包输出

```

## 开发命令

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 编译主进程
npm run build:main

# 编译渲染进程
npm run build:renderer

# 完整构建
npm run build

# 打包 Windows 版本
npm run package:win

# 打包 macOS 版本
npm run package:mac

# 代码检查
npm run lint

# 代码格式化
npm run format
```

## 开发环境

- Node.js 20+
- npm 或 yarn
- VSCode（推荐）

## 技术栈

- **桌面框架**: Electron 28+
- **前端**: React 18 + TypeScript
- **构建工具**: Vite + TypeScript Compiler
- **打包工具**: electron-builder
- **代码质量**: ESLint + Prettier

## 下一步

1. 实现 IPC 通信层
2. 实现后端服务（ConfigManager, ProxyManager 等）
3. 迁移 React 前端代码
4. 实现平台抽象层
5. 配置打包和发布流程
