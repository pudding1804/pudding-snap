---
alwaysApply: false
description: 
---
# 极简游戏截图管理器 - 项目规则

## 项目概述
这是一个基于 Tauri v2 + React 的桌面应用程序，用于自动捕获、管理和组织游戏截图。

## 技术栈
- **前端**: React 18.x (函数式组件 + Hooks)
- **后端**: Rust + Tauri v2
- **数据库**: SQLite (rusqlite)
- **图片处理**: image-rs (WebP格式)

## 目录结构

```
ScreenshotProject/
├── src/                          # 前端源码
│   ├── components/               # React 组件
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
│       │   ├── screenshot.rs    # 截图相关命令
│       │   ├── game.rs          # 游戏相关命令
│       │   ├── steam.rs         # Steam 相关命令
│       │   ├── migration.rs     # 迁移相关命令
│       │   ├── settings.rs      # 设置相关命令
│       │   └── window.rs        # 窗口相关命令
│       ├── database.rs           # 数据库操作
│       ├── models.rs             # 数据模型
│       ├── screenshot.rs         # 截图处理
│       ├── steam.rs              # Steam API
│       ├── bangumi.rs            # Bangumi API
│       └── main.rs               # 应用入口
│
└── docs/
    └── TECHNICAL_DESIGN.md       # 技术设计文档
```

## 开发规范

### 命名规范
- 组件：PascalCase (如 `ScreenshotGrid`)
- 函数：camelCase (如 `loadScreenshots`)
- 常量：UPPER_SNAKE_CASE (如 `DEBUG_MODE`)
- 文件：与导出内容一致

### 代码风格
- 使用函数式组件和 Hooks
- 样式使用内联对象 (不使用 CSS 文件)
- 多语言文本使用 `t` 对象
- Rust 错误处理使用 `Result` 类型

### Tauri 命令规范

```rust
#[tauri::command]
pub fn command_name(
    param1: Type1,
    state: State<AppState>,
) -> Result<ReturnType, String> {
    // 实现
}
```

### 前端调用规范

```javascript
const result = await invoke('command_name', { param1: value1 })
```

## 核心功能
1. 全局热键截图 (PrintScreen)
2. 自动识别游戏进程
3. Steam 信息自动匹配
4. Bangumi 游戏信息拉取
5. 截图分类管理
6. 数据迁移与导入
7. 手动添加游戏
8. 批量导入截图
9. 多选删除功能
10. 系统托盘未读徽章

## 注意事项
1. 所有路径使用绝对路径存储
2. 迁移时需要更新数据库中的路径
3. Windows 路径分隔符处理
4. 删除文件前先删除数据库记录
5. 导入时保留原始创建时间
6. Bangumi API 必须遵守 User-Agent 格式要求
7. Bangumi API 搜索使用 POST 请求
8. Bangumi API 速率限制：1秒间隔

## 编译命令
- 后端检查: `cd src-tauri && cargo check`
- 前端构建: `npm run build`
- 完整构建: `npm run tauri build`
