# 极简游戏截图管理器

一个优雅、轻量的 Windows 原生应用，用于管理游戏截图。

## 功能特性

- 静默截图：接管 PrintScreen 键，无干扰截图
- 游戏识别：自动识别当前游戏
- WebP 压缩：高效图片压缩
- 时间/游戏浏览：多种截图浏览方式
- 笔记功能：为截图添加备注
- 系统托盘：后台运行

## 技术栈

- 后端：Rust + Tauri v2
- 前端：React + Vite + Tailwind CSS
- 数据库：SQLite

## 安装

```bash
npm install
npm run tauri dev
```

## 使用

1. 运行应用后会在系统托盘显示图标
2. 按 PrintScreen 键截图
3. 双击托盘图标打开主界面
