# PuddingSnap 截图机制完整说明

> 本文档整理了 PuddingSnap 的完整截图机制，用于向其他 AI 描述问题背景。

---

## 一、项目概述

**PuddingSnap** 是一个基于 Tauri v2 + React 的 Windows 原生桌面应用，核心功能是**游戏截图自动管理**。用户按下 PrintScreen 键即可静默截图，应用会自动识别前台游戏进程、匹配游戏信息、保存截图并生成缩略图。

**关键文件路径：**
- 截图引擎: `src-tauri/src/screenshot.rs`
- 截图触发+处理: `src-tauri/src/main.rs` (约第 1970-2570 行)
- Windows 工具: `src-tauri/src/windows_utils.rs`
- 数据库: `src-tauri/src/database.rs`
- 热键监听: `src-tauri/src/raw_input.rs`, `src-tauri/src/keyboard_hook.rs`

---

## 二、截图触发流程 (热键 → 保存完整链路)

### 2.1 热键监听

双通道热键监听，确保可靠捕获：
- **raw_input** (低延迟原始输入监听，主要)
- **keyboard_hook** (Windows 键盘钩子，备份)
- 支持 PrintScreen 和 F12 两个热键
- 100ms 内去重，防止重复触发

### 2.2 截图完整处理链路

热键按下后的完整执行流程：

```
热键触发
  │
  ├─ 1. 播放快门音效 (audio.rs)
  │
  ├─ 2. 获取前台进程信息 (windows_utils.rs)
  │     ├─ process_name (exe名称，不含.exe后缀)
  │     ├─ exe_path (完整路径)
  │     └─ window_title (窗口标题，特殊情况才获取)
  │
  ├─ 3. 检测 Steam RunningAppID (注册表)
  │     └─ 验证该 AppID 是否与前台进程匹配
  │
  ├─ 4. ⭐ 调用 capture_screenshot(false) 进行截图 (screenshot.rs)
  │     └─ 返回 DynamicImage
  │
  ├─ 5. 构建 ScreenshotTask 入队
  │
  ├─ 6. 异步队列处理:
  │     ├─ a. 生成/查找 game_id (database.rs)
  │     ├─ b. 保存原图 (screenshot.rs save_image)
  │     ├─ c. 生成并保存缩略图 (320px 最大边)
  │     ├─ d. 写入 SQLite 数据库
  │     ├─ e. 更新托盘图标 (未读计数徽章)
  │     ├─ f. 发送系统通知
  │     ├─ g. 发送前端事件 (screenshot-taken)
  │     └─ h. 后台线程: 提取 exe 图标 + Steam 信息匹配
  └─
```

### 2.3 游戏 ID (game_id) 生成策略

`generate_game_id(process_name, exe_path, window_title)`:

1. **判断是否为模拟器进程**：如果是模拟器（进程名匹配模拟器列表），从窗口标题提取游戏名作为有效名称
2. **RPG Maker 特殊处理**：读取 Game.ini 或 System.json 获取游戏标题
3. **通用逻辑**：组合 `effective_name:文件夹名` 进行哈希
4. **兜底**：仅用进程名哈希
5. 输出 16 进制哈希字符串

---

## 三、核心截图引擎 (screenshot.rs) — 关键部分

### 3.1 双引擎架构

| 引擎 | 技术 | 特点 |
|------|------|------|
| **DXGI** | `dxgi-capture-rs` crate, DirectX 接口 | 速度快，支持硬件加速画面，按显示器索引捕获 |
| **GDI** | Windows `BitBlt` API | 兼容性好，可捕获指定窗口客户区，支持鼠标光标 |

### 3.2 截图策略调度 — capture_screenshot()

这是核心调度函数，智能选择最佳截图方式：

```rust
pub fn capture_screenshot(capture_mouse: bool) -> Result<DynamicImage, ...>
```

**完整调度流程：**

```
capture_screenshot(false)
  │
  ├─ 获取前台窗口句柄 (hwnd)
  │
  ├─ 判断是否全屏: is_window_fullscreen(hwnd)
  │     ├─ IsZoomed 检测 (最大化)
  │     └─ 窗口尺寸 vs 显示器尺寸 匹配检测
  │
  ├─ 获取显示器索引: get_dxgi_output_index_for_window(hwnd)
  │
  ├─ [分支 A] 如果全屏:
  │     ├─ 优先: capture_dxgi_monitor(monitor_index)
  │     │    └─ 成功 + 非空白 + 尺寸>100 → 返回
  │     ├─ 失败: capture_window_by_hwnd(hwnd, false) [GDI]
  │     │    └─ 成功 + 尺寸>100 → 返回
  │     └─ 兜底: capture_fullscreen(false) [GDI]
  │
  └─ [分支 B] 如果非全屏:
        ├─ 优先: capture_window_by_hwnd(hwnd, false) [GDI]
        │    └─ 成功 + 尺寸>100 → 返回
        ├─ 次选: capture_dxgi_monitor 全屏 + crop_to_window_on_monitor 裁剪
        │    └─ 成功 + 非空白 + 尺寸>100 → 返回
        └─ 兜底: capture_fullscreen(false) [GDI]
```

### 3.3 全屏检测 — is_window_fullscreen()

```rust
fn is_window_fullscreen(hwnd: HWND) -> bool {
    // 1. IsZoomed 检测窗口是否最大化
    // 2. GetWindowRect + GetMonitorInfoW 检测窗口是否覆盖整个显示器
    //    (允许2像素误差容限)
}
```

### 3.4 DXGI 捕获 — capture_dxgi_monitor()

- 使用 `dxgi-capture-rs` crate
- 指定显示器索引进行捕获
- 返回 BGRA 格式像素，转换为 RGBA
- 超时/访问被拒绝/访问丢失 均有错误处理

### 3.5 GDI 窗口捕获 — capture_window_by_hwnd()

```rust
fn capture_window_by_hwnd(hwnd: HWND, capture_mouse: bool)
```

- 获取窗口**客户区** (client rect) 尺寸和屏幕坐标
- 获取桌面 DC → 创建兼容 DC → 创建兼容位图
- **BitBlt 从屏幕 DC 复制客户区像素**
- 可选：绘制鼠标光标
- GetDIBits 读取像素数据
- BGRA → RGBA 转换 (swap(0, 2))

### 3.6 GDI 全屏捕获 — capture_fullscreen()

- 通过 GetSystemMetrics 获取屏幕尺寸
- 与窗口捕获类似，但从 (0,0) 开始 BitBlt 整个屏幕

### 3.7 DXGI 全屏 + 裁剪 — crop_to_window_on_monitor()

当 GDI 窗口捕获失败时，先用 DXGI 捕获整个显示器，再根据窗口客户区在屏幕上的坐标进行裁剪：

```rust
fn crop_to_window_on_monitor(fullscreen_image, hwnd)
```

- 获取客户区矩形和屏幕坐标
- 获取显示器原点 (rcMonitor)
- 计算相对偏移: `(client_origin - monitor_origin)`
- 裁剪出对应区域

### 3.8 空白检测 — is_image_blank()

采样检测截图是否为全黑或全透明：

- 采样约 200 个像素
- 判断条件：alpha=0 或 RGB 均 < 5
- 超过 95% 像素满足条件 → 判定为空白

---

## 四、模拟器相关处理

### 4.1 内置模拟器进程名列表

`windows_utils.rs` 中定义了约 40+ 个已知模拟器进程名：

```rust
const EMULATOR_PROCESS_NAMES: &[&str] = &[
    "dosbox", "dosbox-x", "dosbox-staging",
    "retroarch",
    "pcsx2", "pcsx2-qt",
    "rpcs3", "cemu",
    "yuzu", "suyu", "ryujinx",
    "dolphin", "ppsspp", "ppssppwindows",
    "mame", "mame64", "mameui",
    "snes9x", "snes9x-x64",
    "fusion", "kega-fusion", "kega",
    "mednafen", "flycast",
    "melonds", "desmume",
    "vba", "visualboyadvance", "visualboyadvance-m", "vbam",
    "citra", "xemu",
    "project64", "project64c",
    "bsnes", "mesen", "nestopia", "fceux",
    "gens", "nullDC", "nulldc", "redream",
];
```

> **注意：列表中不含 `emulationstation` 进程名。**

### 4.2 自定义模拟器名支持

用户可以在设置中添加自定义模拟器进程名：

```rust
static CUSTOM_EMULATOR_NAMES: RwLock<Vec<String>> = Vec::new();
pub fn set_custom_emulator_names(names: Vec<String>);
pub fn get_custom_emulator_names() -> Vec<String>;
```

### 4.3 模拟器窗口标题提取游戏名

当检测到前台进程是模拟器时，从窗口标题中提取游戏名：

```rust
pub fn extract_game_name_from_title(title: &str, process_name: &str) -> String
```

处理逻辑：
1. 根据当前进程名确定模拟器类型
2. 移除模拟器后缀（如 `" - RetroArch"`, `" | retroarch"`, `" [pcsx2]"` 等）
3. 移除通用后缀（如 `" - Emulator"`, `" - ROM"`）
4. 清理窗口标题（移除加载中、暂停、分辨率、版本号等信息）

### 4.4 模拟器场景下的 game_id 生成

如果进程是模拟器且有窗口标题，优先使用从窗口标题提取的游戏名来生成 game_id：

```rust
let effective_name = if is_emulator {
    if let Some(title) = window_title {
        let extracted = extract_game_name_from_title(title, process_name);
        if !extracted.is_empty() { extracted } else { process_name }
    } else { process_name }
};
```

---

## 五、关于 RetroBat + EmulationStation 的针对性分析

### 5.1 RetroBat 架构

RetroBat 是一个 Windows 下的游戏前端整合包，其典型运行架构：

```
RetroBat Launcher
    └─ EmulationStation (前端界面，窗口管理)
         └─ 模拟器核心 (RetroArch / PCSX2 / Dolphin 等)
              ├─ 游戏内容 (通过 GPU 硬件加速渲染)
              └─ Bezel/Overlay (边框装饰层)
```

### 5.2 截图引擎在当前架构下可能遇到的问题

#### 问题 1: 窗口层级问题

EmulationStation 或模拟器可能使用多个窗口/图层：
- 主窗口包含 bezel 背景
- 游戏画面渲染在子窗口或独立 surface 上
- GDI 的 BitBlt 只能捕获到主窗口客户区，可能**只捕获到 bezel 层**，无法捕获底层的游戏画面

#### 问题 2: GPU 硬件加速渲染

模拟器使用 DirectX / Vulkan / OpenGL 进行游戏渲染：
- **GDI 的 BitBlt 无法捕获 GPU 硬件加速的内容** → 游戏区域显示为黑屏/空白
- DXGI 理论上可以捕获，但在多窗口/覆盖层场景中可能只捕获到最顶层

#### 问题 3: Bezel/Overlay 作为独立覆盖层

RetroArch 的 bezel 系统：
- Bezel 是一个**覆盖层 (overlay)**，作为单独的图层渲染在游戏画面之上
- Bezel 中间区域是透明的，目的是透出下方的游戏画面
- 截图引擎可能捕获了 bezel 层，但**获取不到 bezel 下方的游戏画面**

这是因为：
- 在 DXGI 捕获中，bezel overlay 和游戏画面可能分属不同的 D3D 交换链 (swap chain)
- DXGI 的 `capture_frame()` 通常只捕获**桌面窗口管理器 (DWM) 最终合成后的画面**
- 但如果游戏使用**独占全屏 (exclusive fullscreen)**，DWM 合成可能会出现问题

#### 问题 4: 窗口标题处理

`EmulationStation` 进程名不在已知模拟器列表中，这意味着：
- 当前台进程是 `EmulationStation` 时，不会被识别为模拟器
- 不会进入"从窗口标题提取游戏名"的分支
- game_id 会直接用进程名 `emulationstation` 生成
- 但实际上，当模拟器（如 RetroArch）作为子进程运行时，前台窗口可能已经是模拟器进程

### 5.3 当前截图流程在 RetroBat 场景下的模拟

假设用户通过 RetroBat 启动了一个游戏：

```
1. EmulationStation 启动模拟器 (如 retroarch.exe)
2. RetroArch 创建窗口，加载 bezel overlay
3. 游戏画面开始渲染 (GPU 硬件加速)
4. 用户按下 PrintScreen
5. get_foreground_process_info() → process_name = "retroarch"
6. is_window_fullscreen(hwnd) → 可能 true 或 false
7. 进入截图调度:
   a. 如果全屏 → capture_dxgi_monitor → 可能只捕获到 bezel overlay
   b. 如果非全屏 → GDI 窗口捕获 → bezel 层可见，游戏区域空白
   c. DXGI 全屏+裁剪 → 同上问题
```

---

## 六、关键信息汇总（用于向其他 AI 提问）

### 6.1 技术栈

| 项目 | 内容 |
|------|------|
| 桌面框架 | Tauri v2 (Rust 后端) |
| DXGI 截图库 | `dxgi-capture-rs` v1.0 (基于 IDXGIOutputDuplication) |
| GDI 截图 | Windows `BitBlt` + `GetDIBits` |
| 图片处理 | `image-rs` v0.25, `webp` v0.3 |
| 热键监听 | `raw_input` + `keyboard_hook` 双通道 |

### 6.2 问题现象

- 截图能捕获到 bezel (边框装饰) 部分
- 但 bezel 中间的游戏内容区域显示为空白/黑色
- 截图的总体尺寸和位置看起来是正确的

### 6.3 需要 AI 回答的核心问题

1. 在 RetroArch/RetroBat 这类使用 overlay/bezel 系统的模拟器中，DXGI 的 `IDXGIOutputDuplication` 能否捕获到 bezel 下方的游戏画面？
2. 如果 bezel 和游戏画面分属不同的 D3D 交换链，有什么 API 可以同时捕获两者？
3. 是否有方法获取特定窗口的完整合成画面（包含所有子窗口和覆盖层）？
4. 对于使用 GPU 硬件加速渲染 + overlay 覆盖层的场景，Windows 上有哪些截图方案？
5. 是否可以通过捕获 D3D 设备/交换链来绕过 overlay 直接获取游戏渲染内容？
