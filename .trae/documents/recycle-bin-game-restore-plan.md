# 回收站游戏项目恢复方案

## 问题描述

当前删除游戏时，所有截图被软删除到 `deleted_screenshots` 表，但 `game_cache` 记录被永久删除。恢复截图后，`game_cache` 中没有对应的游戏记录，导致游戏不出现在游戏列表中。

## 方案设计

### 核心思路：新增 `deleted_games` 表

删除游戏时，将 `game_cache` 记录移入 `deleted_games` 表（而非永久删除）。恢复截图时，检查该截图的 `game_id` 是否存在于 `game_cache`，如果不存在则从 `deleted_games` 中恢复。

### 为什么不用"恢复截图时自动重建 game_cache"的方案？

`game_cache` 包含 `exe_path`、`icon_path`、`steam_appid`、`steam_name`、`steam_logo_path`、`steam_match_status` 等信息，这些无法从截图记录中重建。必须保存原始的 game_cache 数据。

## 实现步骤

### 1. 数据库层 (database.rs)

#### 1.1 新增 `deleted_games` 建表语句

```sql
CREATE TABLE IF NOT EXISTS deleted_games (
    game_id TEXT PRIMARY KEY,
    exe_path TEXT,
    icon_path TEXT,
    display_title TEXT,
    last_updated INTEGER,
    steam_appid INTEGER,
    steam_name TEXT,
    steam_logo_path TEXT,
    steam_match_status TEXT,
    deleted_at INTEGER NOT NULL
)
```

在 `initialize_database` 中添加建表和索引语句。

#### 1.2 修改 `delete_game` 函数

当前逻辑：
1. 软删除所有截图 → `deleted_screenshots`
2. 永久删除 `game_cache` 记录

修改为：
1. 软删除所有截图 → `deleted_screenshots`
2. 将 `game_cache` 记录移入 `deleted_games`（而非永久删除）

#### 1.3 修改 `restore_screenshot` 函数

在恢复截图后，增加一步：
1. 检查该截图的 `game_id` 是否存在于 `game_cache`
2. 如果不存在，检查 `deleted_games` 中是否有该 `game_id`
3. 如果有，将记录从 `deleted_games` 移回 `game_cache`

#### 1.4 修改 `permanent_delete_screenshot` 函数

在永久删除截图后，增加一步：
1. 检查该截图的 `game_id` 在 `deleted_screenshots` 中是否还有记录
2. 如果没有，从 `deleted_games` 中删除该游戏记录（已无恢复可能）

#### 1.5 修改 `cleanup_expired_deleted` 函数

在清理过期记录后，增加一步：
1. 查找 `deleted_games` 中 `deleted_at` 超过30天的记录
2. 检查这些游戏是否在 `deleted_screenshots` 中还有未过期的截图
3. 如果没有未过期的截图，删除该游戏记录及其所有过期截图

### 2. 不需要修改的部分

- **前端**：不需要修改，恢复截图后游戏自动出现在游戏列表
- **Tauri 命令**：不需要新增命令，所有逻辑在后端自动处理
- **删除单张截图**：不需要移动 game_cache（因为游戏仍在列表中，只是少了一张截图）

## 文件修改清单

| 文件 | 修改内容 |
|------|---------|
| `src-tauri/src/database.rs` | 新增 `deleted_games` 建表；修改 `delete_game`、`restore_screenshot`、`permanent_delete_screenshot`、`cleanup_expired_deleted` |

仅修改一个文件，改动量小，风险低。
