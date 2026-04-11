---
alwaysApply: false
description:
---
# PuddingSnap - 项目规则

## 项目概述
PuddingSnap 是一个基于 Tauri v2 + React 的桌面应用程序，用于自动捕获、管理和组织游戏截图。

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
│   │   ├── index.js             # 组件导出
│   │   ├── Sidebar.jsx          # 侧边栏
│   │   ├── ScreenshotGrid.jsx   # 截图网格
│   │   ├── ScreenshotModal.jsx  # 截图详情弹窗
│   │   ├── GameList.jsx         # 游戏列表
│   │   ├── GameDetail.jsx       # 游戏详情
│   │   ├── SettingsPanel.jsx    # 设置面板
│   │   ├── AddGameModal.jsx     # 添加游戏弹窗
│   │   ├── ImportModal.jsx      # 导入截图弹窗
│   │   ├── ShareModal.jsx       # 分享弹窗
│   │   ├── TitleBar.jsx         # 自定义标题栏
│   │   └── ErrorBoundary.jsx     # 错误边界
│   ├── hooks/                    # 自定义 Hooks
│   │   ├── useAppState.js       # 全局状态管理
│   │   └── useWindowSize.js     # 窗口大小记忆
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
│       │   ├── game.rs          # 游戏相关命令
│       │   ├── steam.rs         # Steam 相关命令
│       │   ├── bangumi.rs       # Bangumi 相关命令
│       │   ├── migration.rs     # 迁移相关命令
│       │   ├── settings.rs      # 设置相关命令
│       │   └── window.rs        # 窗口相关命令
│       ├── database.rs           # 数据库操作
│       ├── models.rs             # 数据模型
│       ├── screenshot.rs         # 截图处理
│       ├── steam.rs             # Steam API
│       ├── bangumi.rs           # Bangumi API
│       ├── windows_utils.rs     # Windows 工具
│       ├── audio.rs             # 音频播放
│       ├── lib.rs               # 库入口
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
1. 全局热键截图 (PrintScreen / F12)
2. 自动识别游戏进程
3. Steam 信息自动匹配
4. Bangumi 游戏信息拉取
5. 截图分类管理
6. 数据迁移与导入
7. 手动添加游戏
8. 批量导入截图
9. 多选删除功能
10. 系统托盘未读徽章
11. 截图分享模板 (5种样式)
12. 窗口大小和位置记忆
13. 多语言支持 (中文/英文/日文)

## 主题列表
- 夜晚 (night)
- 白天 (day)
- 浅粉 (pink)
- 深蓝 (blue)
- 森林 (green)

## 分享模板样式
1. 极简 (minimalist) - 白色背景，简洁设计
2. 赛博 (cyberpunk) - 霓虹灯光效果
3. 拍立得 (polaroid) - 复古即时相机风格
4. 蒸汽波 (vaporwave) - 渐变色彩风格
5. 杂志 (editorial) - 杂志排版风格

## 注意事项
1. 所有路径使用绝对路径存储
2. 迁移时需要更新数据库中的路径
3. Windows 路径分隔符处理
4. 删除文件前先删除数据库记录
5. 导入时保留原始创建时间
6. Bangumi API 必须遵守 User-Agent 格式要求
7. Bangumi API 搜索使用 POST 请求
8. Bangumi API 速率限制：1秒间隔
9. 窗口状态最小尺寸：400x300
10. 无效窗口位置（超出 -10000 范围）不会被保存

## 编译命令
- 后端检查: `cd src-tauri && cargo check`
- 前端构建: `npm run build`
- 完整构建: `npm run tauri build`

## 快捷键
- PrintScreen: 截图
- F12: 测试截图（调试模式）
- F5: 切换调试窗口显示/隐藏
- Escape/Backspace: 关闭弹窗
- 鼠标后退键: 关闭弹窗
