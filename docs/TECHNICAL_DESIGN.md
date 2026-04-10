# 极简游戏截图管理器 - 技术设计文档

## 文档版本
- 版本: 2.1.0
- 更新日期: 2026-04-10
- 作者: AI Assistant

---

## 目录
1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [核心模块说明](#3-核心模块说明)
4. [接口定义规范](#4-接口定义规范)
5. [数据库设计](#5-数据库设计)
6. [性能优化说明](#6-性能优化说明)
7. [开发规范](#7-开发规范)
8. [注意事项](#8-注意事项)

---

## 1. 项目概述

### 1.1 项目简介
极简游戏截图管理器是一个基于 Tauri v2 + React 的桌面应用程序，用于自动捕获、管理和组织游戏截图。

### 1.2 技术栈
| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Tauri | v2.x |
| 后端 | Rust | 1.70+ |
| 前端 | React | 18.x |
| 数据库 | SQLite (rusqlite) | - |
| 图片处理 | image-rs | - |
| 热键监听 | rdev | - |

### 1.3 核心功能
- 全局热键截图 (PrintScreen)
- 自动识别游戏进程
- Steam 信息自动匹配
- Bangumi 游戏信息拉取
- 截图分类管理
- 数据迁移与导入
- 手动添加游戏
- 批量导入截图
- 多选删除功能
- 系统托盘未读徽章

---

## 2. 系统架构

### 2.1 目录结构

```
ScreenshotProject/
├── src/                          # 前端源码
│   ├── components/               # React 组件
│   │   ├── index.js             # 组件导出
│   │   ├── Sidebar.jsx          # 侧边栏
│   │   ├── ScreenshotGrid.jsx   # 截图网格
│   │   ├── ScreenshotModal.jsx  # 截图详情弹窗
│   │   ├── GameList.jsx         # 游戏列表
│   │   ├── GameDetail.jsx       # 游戏详情
│   │   ├── SettingsPanel.jsx    # 设置面板
│   │   ├── AddGameModal.jsx     # 添加游戏弹窗
│   │   └── ImportModal.jsx      # 导入截图弹窗
│   ├── hooks/                    # 自定义 Hooks
│   │   └── useAppState.js       # 全局状态管理
│   ├── i18n/                     # 国际化
│   │   └── translations.js      # 多语言翻译
│   ├── styles/                   # 样式
│   │   ├── themes.js            # 主题定义
│   │   └── sharedStyles.js      # 共享样式
│   ├── App.jsx                   # 主应用组件
│   └── main.jsx                  # 入口文件
│
├── src-tauri/                    # 后端源码
│   └── src/
│       ├── commands/             # Tauri 命令模块
│       │   ├── mod.rs           # 模块导出
│       │   ├── screenshot.rs    # 截图相关命令
│       │   ├── migration.rs     # 迁移相关命令
│       │   ├── settings.rs      # 设置相关命令
│       │   ├── steam.rs         # Steam 相关命令
│       │   ├── window.rs        # 窗口相关命令
│       │   └── game.rs          # 游戏相关命令
│       ├── database.rs           # 数据库操作
│       ├── models.rs             # 数据模型
│       ├── screenshot.rs         # 截图处理
│       ├── steam.rs              # Steam API
│       ├── bangumi.rs            # Bangumi API
│       ├── windows_utils.rs      # Windows 工具
│       ├── audio.rs              # 音频播放
│       ├── lib.rs                # 库入口
│       └── main.rs               # 应用入口
│
└── docs/                         # 文档
    └── TECHNICAL_DESIGN.md       # 本文档
```

### 2.2 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (React)                          │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │Sidebar  │  │Screenshot│  │GameList │  │Settings │        │
│  │         │  │Grid     │  │         │  │Panel    │        │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │
│       │            │            │            │              │
│  ┌────┴────────────┴────────────┴────────────┴────┐        │
│  │              useAppState (状态管理)              │        │
│  └────────────────────────┬───────────────────────┘        │
└───────────────────────────┼─────────────────────────────────┘
                            │ Tauri invoke
┌───────────────────────────┼─────────────────────────────────┐
│                      后端 (Rust)                             │
├───────────────────────────┼─────────────────────────────────┤
│  ┌────────────────────────┴───────────────────────┐        │
│  │              commands (Tauri 命令)              │        │
│  └────────────────────────┬───────────────────────┘        │
│                           │                                  │
│  ┌────────────┐  ┌───────┴───────┐  ┌────────────┐        │
│  │ database.rs│  │ screenshot.rs │  │  steam.rs  │        │
│  └────────────┘  └───────────────┘  └────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. 核心模块说明

### 3.1 前端组件

#### Sidebar.jsx
侧边栏导航组件，负责：
- 显示应用标题
- 导航按钮（按时间浏览、按游戏浏览、设置）
- 日志显示面板
- 折叠/展开功能

#### ScreenshotGrid.jsx
截图网格组件，负责：
- 按时间显示截图列表
- 排序功能（从新到旧/从旧到新）
- 图标大小切换
- 多选删除模式
- 分页导航

#### GameList.jsx
游戏列表组件，负责：
- 显示所有游戏
- 游戏排序（时间/字母）
- 多选删除游戏
- 三点菜单（添加新游戏、多选删除）

#### GameDetail.jsx
游戏详情组件，负责：
- 显示单个游戏的所有截图
- 返回游戏列表
- 检索游戏信息
- 导入截图
- 多选删除截图

#### ScreenshotModal.jsx
截图详情弹窗组件，负责：
- 显示截图大图
- 前后翻页导航
- 添加/编辑附注
- 打开文件夹
- 删除截图

#### SettingsPanel.jsx
设置面板组件，负责：
- 语言设置
- Steam搜索语言设置
- 主题切换
- 存储位置管理
- 开机自启动设置
- 鼠标捕捉设置
- 删除所有数据

#### AddGameModal.jsx
添加游戏弹窗组件，负责：
- 平台选择（Steam/Bangumi）
- 游戏搜索
- 创建游戏记录

#### ImportModal.jsx
导入截图弹窗组件，负责：
- 拖放上传
- 文件选择
- 文件列表显示
- 执行导入

### 3.2 后端模块

#### commands/screenshot.rs
截图相关命令：
- `get_screenshots` - 获取截图列表
- `get_screenshots_with_pagination` - 分页获取截图
- `delete_screenshot` - 删除单个截图
- `delete_screenshots` - 批量删除截图
- `update_note` - 更新附注
- `get_file_metadata` - 获取文件元数据

#### commands/game.rs
游戏相关命令：
- `create_game_from_steam` - 从Steam创建游戏
- `delete_game` - 删除单个游戏
- `delete_games` - 批量删除游戏
- `get_game_screenshot_count` - 获取游戏截图数量
- `import_screenshots` - 导入截图
- `get_all_games_with_empty` - 获取所有游戏（包含空游戏）

#### commands/steam.rs
Steam相关命令：
- `search_steam_game_info` - 搜索Steam游戏信息
- `search_steam_games` - 搜索Steam游戏列表
- `apply_steam_game_info` - 应用Steam游戏信息

#### commands/bangumi.rs
Bangumi相关命令：
- `search_bangumi_games` - 搜索Bangumi游戏列表
- `create_game_from_bangumi` - 从Bangumi创建游戏
- `apply_bangumi_game_info` - 应用Bangumi游戏信息

#### commands/migration.rs
迁移相关命令：
- `migrate_data` - 迁移数据
- `check_data_directory` - 检查数据目录
- `switch_data_directory` - 切换数据目录

#### commands/settings.rs
设置相关命令：
- `get_storage_path` - 获取存储路径
- `get_shutter_sound` - 获取快门音效设置
- `set_shutter_sound` - 设置快门音效
- `delete_all_data` - 删除所有数据
- `restart_app` - 重启应用

#### commands/window.rs
窗口相关命令：
- `show_window` - 显示窗口
- `hide_window` - 隐藏窗口
- `show_main_window` - 显示主窗口
- `open_in_explorer` - 在资源管理器中打开

---

## 4. 接口定义规范

### 4.1 Tauri 命令规范

```rust
#[tauri::command]
pub fn command_name(
    param1: Type1,
    param2: Type2,
    state: State<AppState>,
) -> Result<ReturnType, String> {
    // 实现
}
```

### 4.2 前端调用规范

```javascript
const result = await invoke('command_name', { 
    param1: value1, 
    param2: value2 
})
```

### 4.3 数据模型

#### ScreenshotRecord
```rust
pub struct ScreenshotRecord {
    pub id: i32,
    pub file_path: String,
    pub thumbnail_path: String,
    pub game_id: String,
    pub game_title: String,
    pub display_title: String,
    pub timestamp: i64,
    pub note: Option<String>,
}
```

#### GameSummary
```rust
pub struct GameSummary {
    pub game_id: String,
    pub game_title: String,
    pub display_title: String,
    pub game_banner_url: String,
    pub count: i32,
    pub last_timestamp: i64,
    pub game_icon_path: Option<String>,
    pub steam_logo_path: Option<String>,
}
```

---

## 5. 数据库设计

### 5.1 表结构

#### screenshots 表
```sql
CREATE TABLE IF NOT EXISTS screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    game_id TEXT NOT NULL,
    game_title TEXT NOT NULL,
    display_title TEXT,
    timestamp INTEGER NOT NULL,
    note TEXT
)
```

#### game_cache 表
```sql
CREATE TABLE IF NOT EXISTS game_cache (
    game_id TEXT PRIMARY KEY,
    exe_path TEXT,
    icon_path TEXT,
    display_title TEXT,
    last_updated INTEGER,
    steam_appid INTEGER,
    steam_name TEXT,
    steam_logo_path TEXT,
    steam_match_status TEXT
)
```

---

## 6. 性能优化说明

### 6.1 前端优化
- 使用分页加载截图，避免一次性加载大量数据
- 图片懒加载 (loading="lazy")
- 使用 React.memo 优化组件渲染
- 状态提升减少不必要的重渲染

### 6.2 后端优化
- 数据库连接池管理
- 图片压缩存储 (WebP格式)
- 缩略图预生成
- 异步文件操作

---

## 7. 开发规范

### 7.1 命名规范
- 组件：PascalCase (如 `ScreenshotGrid`)
- 函数：camelCase (如 `loadScreenshots`)
- 常量：UPPER_SNAKE_CASE (如 `DEBUG_MODE`)
- 文件：与导出内容一致

### 7.2 代码风格
- 使用函数式组件和 Hooks
- 样式使用内联对象
- 多语言文本使用 t 对象
- 错误处理使用 Result 类型

### 7.3 Git 提交规范
- feat: 新功能
- fix: 修复bug
- refactor: 重构
- docs: 文档更新
- style: 代码格式

---

## 8. 注意事项

### 8.1 路径处理
- 所有路径使用绝对路径存储
- 迁移时需要更新数据库中的路径
- Windows 路径分隔符处理

### 8.2 Steam API
- 使用 Steam Store API 获取游戏信息
- 图片下载保存到本地 logos 目录
- 支持多语言搜索

### 8.3 Bangumi API
- 使用 Bangumi v0 REST API
- 搜索接口使用 POST 请求
- 必须遵守 User-Agent 格式要求
- 速率限制：1秒间隔
- 优先显示中文标题 (name_cn)
- 图片下载保存到本地 bangumi-logos 目录

### 8.4 文件操作
- 删除文件前先删除数据库记录
- 导入时保留原始创建时间
- 错误处理要完善

### 8.4 状态管理
- 使用 useState 管理组件状态
- 复杂状态考虑使用 useReducer
- 全局状态通过 props 传递

---

## 9. 更新日志

### v2.1.0 (2026-04-10)
- 添加 Bangumi (番组计划) 游戏信息拉取功能
- 添加系统托盘未读徽章显示
- 移除鼠标捕捉功能
- 优化侧边栏布局
- 调试窗口默认隐藏，通过 F5 切换
- 更新版本号至 1.0.0

### v2.0.0 (2026-04-08)
- 重构前端组件架构
- 添加手动添加游戏功能
- 添加批量导入截图功能
- 添加多选删除功能
- 添加删除确认弹窗
- 优化代码结构和可维护性

### v1.0.0
- 初始版本
- 基础截图功能
- 游戏识别
- Steam 信息匹配
