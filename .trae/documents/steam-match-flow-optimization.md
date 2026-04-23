# PuddingSnap 截图后Steam匹配流程优化方案

## 一、现状分析

### 1.1 当前完整匹配流程（截图触发后）

```
热键(PrintScreen/F12)
  → get_foreground_process_info() 获取 process_name + exe_path
  → capture_screenshot() 截图
  → 入队 ScreenshotTask { image, exe_path, process_name }
  → 处理队列:
      1. generate_game_id(process_name, exe_path) — 用 process_name:folder_name 哈希生成ID
      2. find_existing_game_id() — 查找已有game_id（先按game_id查，再按game_title=process_name查）
      3. 确定display_title：缓存优先 → 文件夹名清理 → 进程名
      4. 保存截图+缩略图 → insert_screenshot()
      5. [异步] 提取图标 extract_icon_from_exe()
      6. [异步] 自动Steam匹配：
          检查 has_steam_info → 若无：
            steam::match_game_name(process_name) 
              → clean_process_name(去除.exe/Steam后缀等)
              → search_steam_game(clean_name) 调用Steam Store API搜索
              → 完全匹配？→ Found
              → 唯一结果？→ Found
              → 否则 → Mismatch / NotFound
```

### 1.2 核心问题

| 问题                 | 说明                                                                         |
| ------------------ | -------------------------------------------------------------------------- |
| **进程名匹配不准**        | `match_game_name` 仅靠清理后的进程名去搜Steam Store API，很多游戏进程名与商店名不一致                |
| **没有利用Steam运行时信息** | Steam注册表 `RunningAppID` 可以直接告诉当前运行的Steam游戏AppID，这是最准确的方式                   |
| **游戏移动后识别为不同游戏**   | `generate_game_id` 基于 `process_name:folder_name` 的哈希，移动到新文件夹后哈希值变化，变成"新游戏" |

## 二、目标设计的新流程

```
热键(PrintScreen/F12)
  → get_foreground_process_info() 获取 process_name + exe_path
  → ★ 新增：get_steam_running_appid() 读取注册表 RunningAppID
  → capture_screenshot() 截图
  → 入队 ScreenshotTask { image, exe_path, process_name, steam_appid }
  → 处理队列:
      1. generate_game_id(process_name, exe_path, steam_appid) — 加入steam_appid作为唯一标识
      2. find_existing_game_id() — 查找已有game_id（增强查找逻辑）
      3. 确定display_title
      4. 保存截图+缩略图
      5. [异步] 提取图标
      6. [异步] ★ 新的自动Steam匹配流程：
          ┌─ 步骤A: steam_appid > 0 ?
          │     ├─ YES → 直接用 get_steam_app_details(appid) 获取信息 → Found ✓
          │     └─ NO  → 进入步骤B
          │
          └─ 步骤B: 缓存中已有steam_appid?
                ├─ YES → 已有Steam信息，跳过
                └─ NO  → match_game_name(process_name) 现有逻辑兜底
```

## 三、实施步骤

### 步骤1：添加 winreg 依赖 + 注册表读取函数

**文件**: `src-tauri/Cargo.toml`

* 在 `[dependencies]` 中添加 `winreg = "0.52"`

**文件**: `src-tauri/src/windows_utils.rs`（新增函数）

* 新增 `get_steam_running_appid() -> Option<u32>` 函数

* 使用 `winreg::RegKey` 读取 `HKEY_CURRENT_USER\Software\Valve\Steam\RunningAppID`

* 返回值说明：

  * `Some(appid)` 且 `appid > 0` → 当前正在运行Steam游戏，appid即为该游戏的Steam AppID

  * `Some(0)` 或 `None` → 非Steam游戏或Steam未运行

**实现要点**：

```rust
pub fn get_steam_running_appid() -> Option<u32> {
    use winreg::enums::{HKEY_CURRENT_USER, KEY_READ};
    use winreg::RegKey;
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let steam_key = hkcu.open_subkey_with_flags(
        r"Software\Valve\Steam", KEY_READ
    ).ok()?;
    
    let appid: u32 = steam_key.get_value("RunningAppID").ok()?;
    
    if appid > 0 { Some(appid) } else { None }
}
```

### 步骤2：扩展 ScreenshotTask 数据结构

**文件**: `src-tauri/src/main.rs`（约第30行）

* 在 `ScreenshotTask` 结构体中新增字段 `steam_appid: Option<u32>`

```rust
struct ScreenshotTask {
    image: DynamicImage,
    exe_path: Option<String>,
    process_name: String,
    steam_appid: Option<u32>,  // ★ 新增
}
```

### 步骤3：修改热键回调，在截图时获取Steam AppID

**文件**: `src-tauri/src/main.rs`（约第1783-1830行的热键监听回调）

* 在获取 `process_info` 后，调用 `windows_utils::get_steam_running_appid()` 获取当前Steam AppID

* 将 `steam_appid` 传入 `ScreenshotTask`

```rust
// 在现有代码 process_info 之后添加：
let steam_appid = windows_utils::get_steam_running_appid();

let task = ScreenshotTask {
    image,
    exe_path: process_info.exe_path,
    process_name: process_info.process_name,
    steam_appid,  // ★ 新增
};
```

### 步骤4：优化 generate\_game\_id — 加入唯一标识防移动误判

**文件**: `src-tauri/src/database.rs`（第98-122行）

**核心思路**：当有 `steam_appid` 时，将 `steam_appid` 作为生成 game\_id 的关键因子之一。这样即使同一游戏被移动到不同文件夹，只要它来自同一个Steam游戏，game\_id 就保持一致。

```rust
pub fn generate_game_id(process_name: &str, exe_path: Option<&str>, steam_appid: Option<u32>) -> String {
    let mut hasher = DefaultHasher::new();
    
    // ★ 最高优先级：有Steam AppID时，以steam_appid为主键
    if let Some(appid) = steam_appid {
        if appid > 0 {
            let unique_key = format!("steam_{}", appid);
            unique_key.hash(&mut hasher);
            return format!("{:x}", hasher.finish());
        }
    }
    
    // 以下保持原有逻辑不变...
    if let Some(exe) = exe_path {
        // RPG Maker特殊处理
        // 文件夹名处理
    }
    // 兜底：仅进程名
}
```

**注意**：函数签名变更需要同步更新所有调用处。

### 步骤5：增强 find\_existing\_game\_id — 支持通过steam\_appid反查

**文件**: `src-tauri/src/database.rs`（第124-146行）

在现有查找逻辑基础上增加：

* 当传入 `steam_appid` 时，额外查询 `game_cache` 表中 `steam_appid` 匹配的记录

* 这样即使 game\_id 哈希变了（比如旧数据），也能通过 steam\_appid 找回同一个游戏

```rust
pub fn find_existing_game_id(conn: &Connection, process_name: &str, exe_path: Option<&str>, steam_appid: Option<u32>) -> (String, bool) {
    let game_id = generate_game_id(process_name, exe_path, steam_appid);
    
    // 1. 按game_id查找screenshots表（原有）
    // 2. 按game_title=process_name查找（原有）
    // 3. ★ 新增：按steam_appid查找game_cache表
    if let Some(appid) = steam_appid {
        if appid > 0 {
            if let Some(existing_id) = conn.query_row(
                "SELECT game_id FROM game_cache WHERE steam_appid = ?1 LIMIT 1",
                params![appid],
                |row| row.get::<_, String>(0)
            ).ok() {
                return (existing_id, true);
            }
        }
    }
    
    (game_id, false)
}
```

### 步骤6：重写自动Steam匹配入口 — 新的两阶段匹配策略

**文件**: `src-tauri/src/main.rs`（第2010-2096行）

将现有的单一 `match_game_name` 调用替换为两阶段策略：

```rust
if !has_steam_info {
    let db_for_steam = db_clone.clone();
    let game_id_for_steam = game_id.clone();
    let process_name_for_steam = task.process_name.clone();
    let steam_appid_for_steam = task.steam_appid;  // ★ 新增
    
    std::thread::spawn(move || {
        // ===== 阶段A: Steam运行时AppID直接匹配（最准确）=====
        if let Some(appid) = steam_appid_for_steam {
            println!("[Steam] 通过注册表RunningAppID匹配: {}", appid);
            
            match steam::get_steam_app_details(appid, "schinese") {
                Ok(Some(info)) => {
                    // 下载logo、保存缓存、更新标题...（复用现有Found逻辑）
                    save_steam_match_result(...);
                    return;
                }
                _ => println!("[Steam] RunningAppID={} 但API未找到详情", appid),
            }
        }
        
        // ===== 阶段B: 进程名匹配（原有兜底逻辑）=====
        println!("[Steam] 回退到进程名匹配: {}", process_name_for_steam);
        let result = steam::match_game_name(&process_name_for_steam, "schinese");
        
        // ... 原有的 Found / NotFound 处理逻辑不变 ...
    });
}
```

### 步骤7：同步更新所有 generate\_game\_id 和 find\_existing\_game\_id 的调用处

以下位置需要同步更新函数调用签名：

| 文件        | 行号      | 变更内容                                                                                    |
| --------- | ------- | --------------------------------------------------------------------------------------- |
| `main.rs` | \~1846  | `find_existing_game_id(conn, &task.process_name, exe_path_ref)` → 加上 `task.steam_appid` |
| `main.rs` | 其他可能调用处 | 同步检查并更新                                                                                 |

### 步骤8：数据库迁移（可选）

如果希望对已有数据做兼容处理，可在 `database.rs` 的迁移逻辑中加入：

* 对已有 `steam_appid` 的记录，补充基于 `steam_appid` 的备用查询索引

* 这不是必须的，因为步骤5中的 `find_existing_game_id` 已经在运行时做了兼容

## 四、完整匹配流程图（优化后）

```
用户按下 PrintScreen/F12
       │
       ▼
┌──────────────────────────────────┐
│ get_foreground_process_info()     │ ← Win32 API
│   → process_name                 │
│   → exe_path                     │
└──────────────┬───────────────────┘
               │
       ┌───────▼────────┐
       │ ★ get_steam_   │ ← 注册表 HKEY_CURRENT_USER\
       │ running_appid()│   Software\Valve\Steam\
       │                │   RunningAppID
       │ → Option<u32>  │   (winreg crate)
       └───────┬────────┘
               │
       ┌───────▼────────┐
       │ capture_screenshot()     │
       └───────┬────────┘
               │
       ┌───────▼──────────────────────────────┐
       │ ScreenshotTask {                      │
       │   image, exe_path, process_name,      │
       │   steam_appid  ← ★ 新增              │
       │ }                                     │
       └───────┬──────────────────────────────┘
               │
       ┌───────▼──────────────────────────────┐
       │ 1. generate_game_id(                  │
       │     process_name, exe_path,           │
       │     steam_appid  ← ★ 新增参数         │
       │   )                                   │
       │                                      │
       │   优先级:                             │
       │   ① steam_appid > 0 → "steam_{appid}" │
       │   ② RPG Maker标题 + 文件夹名          │
       │   ③ 进程名 + 文件夹名                 │
       │   ④ 仅进程名                          │
       └───────┬──────────────────────────────┘
               │
       ┌───────▼──────────────────────────────┐
       │ 2. find_existing_game_id(             │
       │     conn, process_name, exe_path,     │
       │     steam_appid  ← ★ 新增参数         │
       │   )                                   │
       │                                      │
       │   查找顺序:                           │
       │   ① game_id 精确匹配(screenshots表)   │
       │   ② game_title 匹配(screenshots表)    │
       │   ③ ★ steam_appid 反查(game_cache表)  │
       └───────┬──────────────────────────────┘
               │
       ┌───────▼──────────────────────────────┐
       │ 3~5. display_title / 保存截图 / 图标  │ （不变）
       └───────┬──────────────────────────────┘
               │
       ┌───────▼──────────────────────────────┐
       │ 6. ★ 两阶段自动Steam匹配              │
       │                                      │
       │  ┌─ 阶段A: steam_appid 直接匹配? ──┐ │
       │  │  RunningAppID > 0 ?              │ │
       │  │   ├─ YES → get_steam_app_details │ │
       │  │   │        (appid)               │ │
       │  │   │   → Found ✓ (100%准确)      │ │
       │  │   └─ NO  ↓                      │ │
       │  └────────────────────────────────┘ │
       │                                      │
       │  ┌─ 阶段B: 进程名匹配(原有逻辑) ────┐ │
       │  │  match_game_name(process_name)   │ │
       │  │   → clean_process_name           │ │
       │  │   → search_steam_game(API)       │ │
       │  │   → 完全匹配? → Found            │ │
       │  │   → 唯一结果? → Found            │ │
       │  │   → 否则 → NotFound/Mismatch     │ │
       │  └────────────────────────────────┘ │
       └──────────────────────────────────────┘
```

## 五、涉及文件清单

| 文件                               | 操作 | 主要改动                                                                                                  |
| -------------------------------- | -- | ----------------------------------------------------------------------------------------------------- |
| `src-tauri/Cargo.toml`           | 编辑 | 添加 `winreg = "0.52"` 依赖                                                                               |
| `src-tauri/src/windows_utils.rs` | 编辑 | 新增 `get_steam_running_appid()` 函数                                                                     |
| `src-tauri/src/main.rs`          | 编辑 | ① ScreenshotTask 加 steam\_appid 字段 ② 热键回调获取 RunningAppID ③ 更新 find\_existing\_game\_id 调用 ④ 重写两阶段匹配逻辑 |
| `src-tauri/src/database.rs`      | 编辑 | ① generate\_game\_id 加 steam\_appid 参数 ② find\_existing\_game\_id 加 steam\_appid 反查                   |

## 六、注意事项

1. **性能影响**：`get_steam_running_appid()` 是一次简单的注册表读取操作，耗时在微秒级别，不会对截图性能产生可感知的影响
2. **RunningAppID 可靠性**：Steam 客户端只有在**实际启动了某个游戏**时才会设置 RunningAppID；仅打开 Steam 库界面不玩游戏时值为 0
3. **向后兼容**：旧数据没有 steam\_appid 字段的记录会自然走阶段B（进程名匹配），行为与之前完全一致
4. **game\_id 变更风险**：由于 generate\_game\_id 加入 steam\_appid 因子，已有游戏（之前没有 steam\_appid）第一次通过 Steam 运行截图时可能会生成新的 game\_id。find\_existing\_game\_id 的 steam\_appid 反查机制可以缓解这个问题

