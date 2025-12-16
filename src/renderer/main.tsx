import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { ThemeProvider } from '@/components/theme-provider';

// 全局错误处理 - 渲染进程
window.addEventListener('error', (event: ErrorEvent) => {
  console.error('Renderer Error:', event.error);

  // 记录错误到日志
  const errorMessage = event.error?.message || event.message;
  const errorStack = event.error?.stack || '';
  console.error(`渲染进程错误: ${errorMessage}\n${errorStack}`);

  // 阻止默认的错误处理
  event.preventDefault();
});

window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
  console.error('Renderer Unhandled Rejection:', event.reason);

  // 记录错误到日志
  const errorMessage = event.reason instanceof Error ? event.reason.message : String(event.reason);
  const errorStack = event.reason instanceof Error ? event.reason.stack : '';
  console.error(`渲染进程未处理的 Promise 拒绝: ${errorMessage}\n${errorStack}`);

  // 阻止默认的错误处理
  event.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="flowz-ui-theme">
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
