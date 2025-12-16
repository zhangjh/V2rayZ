# FlowZ

FlowZ 是一个基于 Electron 的跨平台代理客户端，支持 Windows 和 macOS。

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

# 完整构建
npm run build

# 打包 Windows 版本
npm run package:win

# 打包 macOS 版本
npm run package:mac

# 代码检查
npm run lint
```

## 技术栈

- **桌面框架**: Electron
- **前端**: React 18 + TypeScript
- **代理核心**: sing-box
- **构建工具**: Vite + TypeScript Compiler
- **打包工具**: electron-builder
