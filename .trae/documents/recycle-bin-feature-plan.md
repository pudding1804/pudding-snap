# 回收站功能实现方案

## 一、功能概述

将截图删除操作从"永久删除"改为"移入回收站"，支持随时恢复，超过30天的项目在启动时自动彻底删除。

## 二、核心设计决策

### 方案选择：独立 `deleted_screenshots` 表 vs 在 `screenshots` 表添加 `deleted_at` 字段

**选择：独立 `deleted_screenshots` 表**

理由：
1. 不影响现有查询性能——所有正常查询无需添加 `WHERE deleted_at IS NULL` 过滤条件
2. 回收站数据与正常数据物理隔离，避免误操作
3. 清理过期记录时操作更简单，直接 `DELETE FROM deleted_screenshots` 即可
4. 回收站表可额外存储 `original_file_path` 和 `original_thumbnail_path`，文件移动后仍可追溯原路径

### 文件处理策略：移动到回收站子目录

删除时将截图文件和缩略图移动到 `screenshot-data/.trash/` 目录下，恢复时移回原路径。

理由：
1. 移动操作比复制快得多（同分区几乎瞬间完成）
2. 不占用额外磁盘空间
3. 文件保持可用状态，缩略图可直接展示

## 三、数据库设计

### 新增 `deleted_screenshots` 表

```sql
CREATE TABLE IF NOT EXISTS deleted_screenshots (
    id INTEGER PRIMARY KEY,
    original_id INTEGER,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT NOT NULL,
    original_file_path TEXT NOT NULL,
    original_thumbnail_path TEXT NOT NULL,
    game_id TEXT NOT NULL,
    game_title TEXT NOT NULL,
    display_title TEXT,
    timestamp INTEGER NOT NULL,
    note TEXT,
    game_banner_url TEXT,
    file_hash TEXT,
    deleted_at INTEGER NOT NULL
)
```

| 字段 | 说明 |
|------|------|
| `original_id` | 原 screenshots 表中的 ID（恢复时不再使用，仅作参考） |
| `file_path` | 当前文件路径（在 .trash/ 目录下） |
| `thumbnail_path` | 当前缩略图路径（在 .trash/ 目录下） |
| `original_file_path` | 删除前的原始文件路径 |
| `original_thumbnail_path` | 删除前的原始缩略图路径 |
| `deleted_at` | 删除时间（Unix 时间戳），用于判断30天过期 |

索引：`CREATE INDEX IF NOT EXISTS idx_deleted_at ON deleted_screenshots(deleted_at)`

### 新增 Rust 数据模型

```rust
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DeletedScreenshotRecord {
    pub id: i32,
    pub original_id: i32,
    pub file_path: String,
    pub thumbnail_path: String,
    pub original_file_path: String,
    pub original_thumbnail_path: String,
    pub game_id: String,
    pub game_title: String,
    pub display_title: String,
    pub timestamp: i64,
    pub note: String,
    pub game_banner_url: String,
    pub file_hash: Option<String>,
    pub deleted_at: i64,
}
```

## 四、后端实现步骤

### 4.1 数据库层 (database.rs)

1. **在 `initialize_database` 中添加建表语句**：创建 `deleted_screenshots` 表和索引
2. **新增 `soft_delete_screenshot(conn, id)`**：
   - 从 `screenshots` 表读取记录
   - 将文件从原路径移动到 `.trash/` 目录
   - 将记录插入 `deleted_screenshots` 表（含 `deleted_at`）
   - 从 `screenshots` 表删除记录
3. **新增 `soft_delete_screenshots(conn, ids)`**：批量软删除
4. **新增 `get_deleted_screenshots(conn, sort_order, page, page_size)`**：分页获取回收站列表
5. **新增 `restore_screenshot(conn, id)`**：
   - 从 `deleted_screenshots` 读取记录
   - 将文件从 `.trash/` 移回原路径
   - 将记录插入回 `screenshots` 表
   - 从 `deleted_screenshots` 删除记录
6. **新增 `restore_screenshots(conn, ids)`**：批量恢复
7. **新增 `permanent_delete_screenshot(conn, id)`**：
   - 从 `deleted_screenshots` 读取记录
   - 删除物理文件
   - 从 `deleted_screenshots` 删除记录
8. **新增 `permanent_delete_screenshots(conn, ids)`**：批量永久删除
9. **新增 `cleanup_expired_deleted(conn)`**：
   - 查找 `deleted_at` 超过30天的记录
   - 删除对应的物理文件
   - 从 `deleted_screenshots` 删除记录
   - 返回清理数量
10. **新增 `get_deleted_screenshots_count(conn)`**：获取回收站数量（用于侧边栏徽章显示）
11. **修改现有 `delete_game` / `delete_games`**：改为调用软删除逻辑

### 4.2 回收站目录管理

- 回收站目录：`{data_dir}/.trash/`
- 文件命名：保持原文件名，如果冲突则添加后缀
- 缩略图子目录：`{data_dir}/.trash/thumbnails/`

### 4.3 命令层 (main.rs)

新增 Tauri 命令：
- `soft_delete_screenshot(id)` — 移入回收站（替代原 delete_screenshot）
- `soft_delete_screenshots(ids)` — 批量移入回收站
- `get_deleted_screenshots(sort_order, page, page_size)` — 获取回收站列表
- `restore_screenshot(id)` — 恢复截图
- `restore_screenshots(ids)` — 批量恢复
- `permanent_delete_screenshot(id)` — 永久删除
- `permanent_delete_screenshots(ids)` — 批量永久删除
- `cleanup_expired_deleted()` — 清理过期记录
- `get_deleted_screenshots_count()` — 获取回收站数量

修改现有命令：
- `delete_screenshot` → 改为调用 `soft_delete_screenshot`
- `delete_screenshots` → 改为调用 `soft_delete_screenshots`
- `delete_game` → 改为调用软删除逻辑
- `delete_games` → 改为调用软删除逻辑

## 五、前端实现步骤

### 5.1 侧边栏 (Sidebar.jsx)

在"设置"按钮上方添加"回收站"导航项：
- 显示回收站图标 + 文字
- 当回收站有内容时，在右侧显示数量徽章（红色小圆点/数字）
- 点击切换到 `recycle-bin` 视图

### 5.2 回收站视图组件 (RecycleBin.jsx) — 新建

参考 ScreenshotGrid 的网格+分页结构：
- **顶部导航栏**：标题"回收站" + 操作按钮
  - 多选模式按钮
  - "清空回收站"按钮（永久删除所有）
  - 排序选择（按删除时间/按原始时间）
- **截图网格**：与 ScreenshotGrid 类似的卡片布局
  - 每张卡片显示缩略图、游戏名、删除时间
  - 悬停时显示"恢复"和"永久删除"操作按钮
- **多选模式**：
  - 选中后显示"恢复选中"和"永久删除选中"按钮
- **底部分页**：复用 Pagination 组件
- **空状态**：显示"回收站为空"

### 5.3 App.jsx 修改

1. 新增 `currentView === 'recycle-bin'` 视图分支
2. 新增 `switchToRecycleBin()` 函数
3. 在 `onNavigate` 中添加 `'recycle-bin'` 导航处理
4. 启动时调用 `cleanup_expired_deleted` 清理过期记录
5. 定期刷新回收站数量（用于侧边栏徽章）
6. 删除操作改为调用软删除命令
7. 切换视图时清除筛选状态

### 5.4 翻译 (translations.js)

三种语言均添加：
- `nav.recycle_bin`：回收站 / Recycle Bin / ゴミ箱
- `recycle_bin.title`：回收站
- `recycle_bin.empty`：回收站为空
- `recycle_bin.restore`：恢复
- `recycle_bin.permanent_delete`：永久删除
- `recycle_bin.restore_selected`：恢复选中
- `recycle_bin.permanent_delete_selected`：永久删除选中
- `recycle_bin.empty_all`：清空回收站
- `recycle_bin.empty_confirm`：确定要清空回收站吗？所有文件将被永久删除，无法恢复。
- `recycle_bin.permanent_delete_confirm`：确定要永久删除吗？此操作无法恢复。
- `recycle_bin.sort_deleted_time`：按删除时间
- `recycle_bin.sort_original_time`：按原始时间
- `recycle_bin.deleted_at`：删除于

## 六、启动时清理逻辑

在 App.jsx 的初始化流程中（`useEffect` 首次加载时），调用 `cleanup_expired_deleted` 命令：
- 查找 `deleted_at` 距今超过30天的记录
- 删除对应的物理文件（截图原图 + 缩略图）
- 从 `deleted_screenshots` 表中删除记录
- 在日志中记录清理结果

## 七、文件修改清单

| 文件 | 修改类型 | 说明 |
|------|---------|------|
| `src-tauri/src/database.rs` | 修改 | 新增建表、软删除、恢复、永久删除、清理过期等函数 |
| `src-tauri/src/models.rs` | 修改 | 新增 DeletedScreenshotRecord 结构体 |
| `src-tauri/src/main.rs` | 修改 | 新增/修改 Tauri 命令，注册到 invoke_handler |
| `src/components/Sidebar.jsx` | 修改 | 添加回收站导航项和徽章 |
| `src/components/RecycleBin.jsx` | 新建 | 回收站视图组件 |
| `src/App.jsx` | 修改 | 添加视图分支、启动清理、删除逻辑改为软删除 |
| `src/i18n/translations.js` | 修改 | 添加回收站相关翻译文本 |

## 八、风险与注意事项

1. **跨分区移动**：如果数据目录和回收站目录在不同分区，移动操作会变为复制+删除，速度较慢。但回收站目录在数据目录的 `.trash/` 子目录下，不存在此问题。
2. **原路径冲突**：恢复时如果原路径已有新文件（如同名截图），需要处理冲突。方案：如果原路径被占用，恢复到数据目录默认位置并更新路径。
3. **数据库一致性**：软删除操作涉及"读取→移动文件→插入新表→删除旧表"多步操作，需在事务中执行，确保原子性。
4. **回收站容量**：回收站文件仍占用磁盘空间，30天自动清理机制可缓解。用户也可手动清空。
5. **删除游戏**：删除游戏时，其下所有截图应逐个软删除到回收站，而非整体删除。
