# PuddingSnap - 极简游戏截图管理器

一个优雅、轻量的 Windows 原生应用，用于管理游戏截图。

## 功能特性

- 静默截图：接管 PrintScreen 键，无干扰截图
- 游戏识别：自动识别当前游戏
- WebP 压缩：高效图片压缩
- 时间/游戏浏览：多种截图浏览方式
- 笔记功能：为截图添加备注
- 系统托盘：后台运行，未读徽章提示
- 多数据源支持：
  - Steam：自动匹配 Steam 游戏信息
  - Bangumi：支持从番组计划拉取游戏信息

## 技术栈

- 后端：Rust + Tauri v2
- 前端：React + Vite
- 数据库：SQLite
- 图片处理：image-rs + imageproc

## 安装

```bash
npm install
npm run tauri dev
```

## 使用

1. 运行应用后会在系统托盘显示图标
2. 按 PrintScreen 键截图
3. 双击托盘图标打开主界面
4. 按 F5 切换调试窗口显示/隐藏

## 游戏信息来源

### Steam
- 自动识别 Steam 游戏
- 支持多语言搜索（中文、英文、日文等）
- 自动下载游戏封面

### Bangumi (番组计划)
- 支持手动搜索游戏
- 优先显示中文标题
- 自动下载游戏封面
- 适用于非 Steam 游戏或日系游戏

## 项目地址

GitHub: https://github.com/pudding1804/pudding-snap
