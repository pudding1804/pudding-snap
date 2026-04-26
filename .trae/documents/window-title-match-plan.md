# 方案：添加"用窗口标题匹配游戏信息"设置选项

## 背景分析

### 当前机制

当前截图时通过 `get_foreground_process_info()` 获取进程名（如 `dosbox`、`retroarch`），然后用进程名去 Steam API 搜索匹配游戏信息。

### 问题

模拟器（DOSBox、RetroArch、PCSX2 等）使用同一个进程名运行不同 ROM，导致：

* 所有 DOSBox 游戏都被识别为同一个游戏

* 进程名 `dosbox` 无法匹配到实际运行的游戏

* 无法区分同一模拟器下的不同游戏

### 窗口标题的优势

* 模拟器窗口标题通常包含游戏名，如 `"仙剑奇侠传 - DOSBox"`

* 普通游戏的窗口标题通常比进程名更准确，如 `"艾尔登法环"` vs `"eldenring"`

* 中文游戏的窗口标题通常是中文名，更容易匹配 Steam 中文信息

### 风险与应对

| 风险                | 应对策略                                         |
| ----------------- | -------------------------------------------- |
| 窗口标题动态变化（加载中、暂停等） | 清理规则移除常见动态后缀                                 |
| 格式不统一（带版本号、平台等）   | 清理规则移除常见附加信息                                 |
| 某些场景窗口标题不可靠       | 作为可选功能，默认关闭；匹配失败时回退到进程名                      |
| game\_id 不稳定      | game\_id 仍基于进程名+exe路径生成，窗口标题仅用于 Steam 匹配和显示名 |

## 实现方案

### 核心原则

1. **默认关闭**：不影响现有用户行为
2. **仅影响 Steam 匹配和显示名**：game\_id 生成逻辑不变
3. **匹配失败回退**：窗口标题匹配失败时，自动回退到进程名匹配
4. **模拟器特殊处理**：从窗口标题中智能提取游戏名

### 修改文件清单

#### 1. `src-tauri/src/windows_utils.rs` — 添加窗口标题获取和解析

**新增函数：**

```rust
// 获取前台窗口标题
pub fn get_foreground_window_title() -> Option<String>

// 判断进程是否为模拟器
pub fn is_emulator_process(process_name: &str) -> bool

// 从窗口标题提取游戏名（模拟器场景）
pub fn extract_game_name_from_title(title: &str, process_name: &str) -> String

// 清理窗口标题中的无关信息
pub fn clean_window_title(title: &str) -> String
```

**模拟器识别列表：**

```
dosbox, dosbox-x, retroarch, pcsx2, rpcs3, cemu, yuzu, ryujinx, 
dolphin, ppsspp, mame, snes9x, fusion, kega-fusion, mednafen, 
flycast, melonds, desmume, vba, visualboyadvance, citra, xemu
```

**窗口标题清理规则：**

* 移除模拟器名称后缀： ` - DOSBox`、 ` - RetroArch`、 ` - PCSX2` 等

* 移除平台信息：`(Steam)`、`[Steam]`、`(GOG)` 等

* 移除版本信息：`v1.x`、`Build xxx` 等

* 移除状态信息：`[暂停]`、`[已暂停]`、`- 加载中` 等

* 移除分辨率信息：`[1920x1080]` 等

#### 2. `src-tauri/src/main.rs` — 修改截图处理流程

**修改** **`ScreenshotTask`** **结构体：**

```rust
struct ScreenshotTask {
    image: DynamicImage,
    exe_path: Option<String>,
    process_name: String,
    steam_appid: Option<u32>,
    window_title: Option<String>,  // 新增
}
```

**修改截图触发处（约 L1900）：**

* 在获取 `process_info` 后，读取 `use_window_title` 设置

* 如果开启，调用 `get_foreground_window_title()` 获取窗口标题

* 将窗口标题传入 `ScreenshotTask`

**修改 Steam 匹配逻辑（阶段B，约 L2187）：**

* 如果开启了窗口标题匹配且有窗口标题：

  * 对模拟器：使用 `extract_game_name_from_title()` 提取游戏名后匹配

  * 对普通游戏：使用 `clean_window_title()` 清理后匹配

  * 匹配失败时回退到进程名匹配

* 如果未开启或无窗口标题：保持现有逻辑

**修改 display\_title 生成逻辑（约 L2001）：**

* 如果开启了窗口标题匹配且有有效窗口标题：

  * 使用清理后的窗口标题作为 display\_title

* 否则：保持现有逻辑

#### 3. `src-tauri/src/steam.rs` — 无需修改

`match_game_name()` 和 `match_game_name_async()` 已接受 `&str` 参数，调用方传入清理后的窗口标题即可，无需修改函数签名。

#### 4. `src-tauri/src/database.rs` — 无需修改

`generate_game_id()` 和 `find_existing_game_id()` 保持不变，game\_id 仍基于进程名+exe路径生成。

#### 5. `src/i18n/translations.js` — 添加国际化文本

三种语言（zh/en/ja）各添加：

```js
// zh
window_title_match: '用窗口标题匹配游戏信息',
window_title_match_hint: '开启后使用窗口标题而非进程名来匹配游戏信息，对模拟器游戏识别更准确',

// en
window_title_match: 'Match Game Info by Window Title',
window_title_match_hint: 'Use window title instead of process name to match game info. More accurate for emulator games',

// ja
window_title_match: 'ウィンドウタイトルでゲーム情報を照合',
window_title_match_hint: 'プロセス名の代わりにウィンドウタイトルを使用してゲーム情報を照合します。エミュレータゲームの認識がより正確です',
```

#### 6. `src/components/SettingsPanel.jsx` — 添加设置 UI

在截图选项区域（`screenshot_notification` 下方）添加一个 checkbox：

```jsx
<input
  type="checkbox"
  id="window_title_match"
  checked={windowTitleMatchEnabled}
  onChange={(e) => onWindowTitleMatchChange(e.target.checked)}
  style={{ width: 18, height: 18, cursor: 'pointer' }}
/>
<label htmlFor="window_title_match" style={{ cursor: 'pointer', color: theme.text, fontSize: 14 }}>
  {t.settings.window_title_match}
</label>
<p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
  {t.settings.window_title_match_hint}
</p>
```

#### 7. `src/App.jsx` — 添加状态管理和持久化

* 添加 `windowTitleMatchEnabled` 状态（默认 `false`）

* 添加 `loadWindowTitleMatch` 从后端读取设置

* 添加 `handleWindowTitleMatchChange` 保存设置到后端

* 使用通用的 `get_setting`/`set_setting` 接口，key 为 `window_title_match`

* 传递 props 到 `SettingsPanel`

### 数据流

```
截图热键触发
    │
    ▼
获取前台进程信息 (process_name, exe_path)
获取 Steam RunningAppID
    │
    ▼ (新增)
读取 window_title_match 设置
    ├── 关闭 → window_title = None
    └── 开启 → get_foreground_window_title() → window_title
    │
    ▼
创建 ScreenshotTask { ..., window_title }
    │
    ▼
生成 game_id (仍基于 process_name + exe_path，不变)
    │
    ▼
生成 display_title
    ├── window_title 有效 → clean_window_title() → display_title
    └── window_title 无效 → 现有逻辑 (文件夹名/进程名)
    │
    ▼
Steam 匹配
    ├── 阶段A: RunningAppID 直接匹配 (不变)
    └── 阶段B: 
        ├── window_title 有效 + 模拟器 → extract_game_name_from_title() → match_game_name()
        ├── window_title 有效 + 普通游戏 → clean_window_title() → match_game_name()
        │   └── 匹配失败 → 回退到 process_name → match_game_name()
        └── window_title 无效 → process_name → match_game_name() (不变)
```

### 设置存储

使用现有 `settings` 表的键值对：

* key: `window_title_match`

* value: `"true"` / `"false"`

* 默认值: `false`

通过 `settings_cache`（`Arc<RwLock<HashMap<String, String>>>`）在内存中缓存，截图时直接读取缓存，无额外性能开销。

### 实施步骤

1. **windows\_utils.rs**：添加 `get_foreground_window_title()`、`is_emulator_process()`、`extract_game_name_from_title()`、`clean_window_title()` 函数
2. **main.rs**：修改 `ScreenshotTask` 添加 `window_title` 字段
3. **main.rs**：修改截图触发处，读取设置并获取窗口标题
4. **main.rs**：修改 display\_title 生成逻辑
5. **main.rs**：修改 Steam 阶段B匹配逻辑
6. **translations.js**：添加三语国际化文本
7. **SettingsPanel.jsx**：添加 checkbox UI
8. **App.jsx**：添加状态管理、加载、保存逻辑
9. **测试验证**：编译运行，测试开启/关闭两种模式

