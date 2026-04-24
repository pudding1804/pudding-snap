# Raw Input 改造评估与实施计划

## 一、现状分析

### 当前热键监听架构

项目使用 `rdev::listen()` 进行全局键盘监听（[main.rs:1843-1868](file:///d:/ScreenshotProject/src-tauri/src/main.rs#L1843-L1868)），其底层实现：

- **rdev 在 Windows 上的实现**：内部使用 `SetWindowsHookExW(WH_KEYBOARD_LL, ...)` 低级键盘钩子
- **只读模式**：当前使用 `listen()` 而非 `grab()`，不会拦截/消费按键，PrintScreen 按下后 Windows 自带截图仍会触发
- **架构**：两个线程通过 `mpsc::channel` 通信
  - 线程1：运行 `rdev::listen()` 回调，检测到 PrintScreen/F12 后发送事件
  - 线程2：接收事件，执行截图流程

### 核心问题

**部分游戏使用 DirectInput 独占模式（Exclusive Mode）捕获键盘输入**，导致 `WH_KEYBOARD_LL` 钩子无法接收到按键事件。受影响的游戏类型：

| 游戏类型 | 代表 | 原因 |
|----------|------|------|
| Wolf RPG Editor 游戏 | 各种日式 RPG | 使用 DirectInput 独占键盘 |
| 旧版 DirectX 全屏游戏 | 部分复古游戏 | 独占模式下钩子被绕过 |
| 某些模拟器 | DOSBox 等 | 独占输入设备 |

**不受影响的类型**：大多数现代游戏使用 XInput 或标准 Windows 消息，`WH_KEYBOARD_LL` 钩子正常工作。

---

## 二、Raw Input 方案评估

### 方案原理

```
┌──────────────────────────────────────────────────────┐
│  Raw Input (RIDEV_INPUTSINK)                         │
│  - 创建隐藏窗口，注册 WM_INPUT 消息                   │
│  - 即使在 DirectInput 独占模式下也能接收按键           │
│  - 检测 PrintScreen / F12                            │
└──────────────┬───────────────────────────────────────┘
               │ 检测到按键
               ↓
┌──────────────────────────────────────────────────────┐
│  去重逻辑 (100ms 时间窗口)                            │
│  - 防止 Raw Input 和钩子同时报告同一按键              │
└──────────────┬───────────────────────────────────────┘
               │ 确认有效按键
               ↓
┌──────────────────────────────────────────────────────┐
│  触发截图流程（与现有逻辑相同）                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│  轻量 WH_KEYBOARD_LL 钩子（独立线程）                 │
│  仅做一件事：检测 VK_SNAPSHOT，返回 1 阻止传播        │
│  不执行任何耗时操作                                   │
└──────────────────────────────────────────────────────┘
```

### 是否有必要改？—— **有必要，但建议分阶段实施**

**理由**：
1. **核心功能缺陷**：作为游戏截图工具，无法在部分游戏中截图是根本性缺陷
2. **目标用户群**：使用此类工具的用户恰恰更可能玩受影响的游戏类型（日式 RPG、模拟器等）
3. **额外收益**：WH_KEYBOARD_LL 钩子可以阻止 PrintScreen 传播，避免 Windows 自带截图叠加层干扰

### 风险评估 —— **中等风险，可控**

| 风险项 | 风险等级 | 说明 | 缓解措施 |
|--------|----------|------|----------|
| 去重逻辑竞态 | 🟡 中 | Raw Input 和钩子可能同时触发，需防止重复截图 | 100ms 时间窗口 + 原子时间戳比较 |
| 隐藏窗口管理 | 🟢 低 | 需要创建隐藏窗口和独立消息循环 | 标准 WinAPI 模式，文档完善 |
| 钩子线程稳定性 | 🟡 中 | WH_KEYBOARD_LL 钩子可能被系统移除（现有 rdev 也有此问题） | 添加钩子重装机制 + 心跳检测 |
| rdev 移除后兼容性 | 🟢 低 | 项目仅支持 Windows，rdev 的跨平台特性无价值 | 保留 rdev 作为可选回退 |
| 新增代码复杂度 | 🟡 中 | 两个新模块，增加维护成本 | 模块化设计，职责单一 |
| 编译/依赖风险 | 🟢 低 | winapi 已在项目中使用，无需新增依赖 | 仅使用已有的 winapi crate |

---

## 三、实施计划

### 阶段一：新增 Raw Input 模块（不删除 rdev，双轨运行）

#### 步骤 1：创建 `raw_input.rs` 模块

**文件**：`src-tauri/src/raw_input.rs`（新建）

**功能**：
- 创建隐藏窗口（`CreateWindowExW`，使用 `MESSAGE` 类）
- 注册 Raw Input 设备（`RegisterRawInputDevices`，`RIDEV_INPUTSINK` 标志）
- 处理 `WM_INPUT` 消息，解析 `RAWKEYBOARD` 结构
- 检测 `VK_SNAPSHOT`（PrintScreen）和 `VK_F12`
- 通过回调/channel 将热键事件传出
- 去重逻辑：记录上次触发时间，100ms 内的重复事件忽略

**关键 WinAPI 调用**：
```rust
// 注册 Raw Input
RAWINPUTDEVICE {
    usUsagePage: 0x01,  // Generic Desktop
    usUsage: 0x06,      // Keyboard
    dwFlags: RIDEV_INPUTSINK,  // 即使不在前台也接收
    hwndTarget: hidden_window,
}

// 消息循环
while GetMessageW(&mut msg, null, 0, 0) {
    if msg.message == WM_INPUT {
        // 解析 RAWINPUT
        GetRawInputData(...)
        // 提取按键信息
        raw_keyboard.VKey -> VK_SNAPSHOT / VK_F12
    }
}
```

#### 步骤 2：创建 `keyboard_hook.rs` 模块

**文件**：`src-tauri/src/keyboard_hook.rs`（新建）

**功能**：
- 安装 `WH_KEYBOARD_LL` 低级键盘钩子
- **仅检测 `VK_SNAPSHOT`**，返回 1 阻止传播（防止 Windows 自带截图）
- 不执行任何耗时操作，不触发截图流程
- 钩子运行在独立线程，维护自己的消息循环
- 钩子被移除时自动重装（心跳检测机制）

**关键 WinAPI 调用**：
```rust
SetWindowsHookExW(WH_KEYBOARD_LL, callback, null, 0)
// callback 中：
if nCode >= 0 && vCode == VK_SNAPSHOT {
    return 1;  // 阻止传播
}
CallNextHookEx(...)
```

#### 步骤 3：在 `lib.rs` 中注册新模块

**文件**：`src-tauri/src/lib.rs`

**修改**：添加 `pub mod raw_input;` 和 `pub mod keyboard_hook;`

#### 步骤 4：重构 `main.rs` 热键监听逻辑

**文件**：`src-tauri/src/main.rs`

**修改**：
- 移除 `use rdev::{listen, Event, EventType, Key};`
- 在 `setup` 闭包中：
  - 启动 `raw_input::start_raw_input_listener()` 线程（替代 rdev 监听线程）
  - 启动 `keyboard_hook::start_keyboard_hook()` 线程
  - 保留现有的 `hotkey_rx` 处理线程（截图流程不变）
- Raw Input 模块通过同一个 `hotkey_tx` 发送事件

#### 步骤 5：实现去重逻辑

**位置**：`raw_input.rs` 中

**逻辑**：
- 使用 `Arc<Mutex<Instant>>` 记录上次热键触发时间
- Raw Input 检测到按键时，检查距上次触发是否 < 100ms
- 如果 < 100ms，忽略（说明钩子已经触发过了）
- 如果 >= 100ms，正常触发

#### 步骤 6：编译验证

- 运行 `cargo check` 确保编译通过
- 运行 `cargo build` 确保完整构建成功

### 阶段二：测试验证

#### 步骤 7：功能测试

| 测试场景 | 预期结果 |
|----------|----------|
| 普通桌面应用（记事本等） | PrintScreen 触发截图，Windows 自带截图不弹出 |
| 窗口化游戏 | PrintScreen 触发截图 |
| 全屏 DirectX 游戏 | PrintScreen 触发截图 |
| Wolf RPG Editor 游戏 | PrintScreen 触发截图（之前不行，现在可以） |
| F12 键（调试模式） | 正常触发截图 |
| 快速连续按键 | 去重生效，不重复截图 |

#### 步骤 8：稳定性测试

- 长时间运行（1小时+），确认钩子不被系统移除
- 反复切换游戏/桌面，确认热键始终有效
- 游戏崩溃后，确认热键仍正常工作

### 阶段三：清理（确认稳定后）

#### 步骤 9：移除 rdev 依赖

**文件**：`src-tauri/Cargo.toml`

**修改**：删除 `rdev = "0.5"` 行

---

## 四、关键代码变更摘要

| 文件 | 操作 | 说明 |
|------|------|------|
| `src-tauri/src/raw_input.rs` | 新建 | Raw Input 监听模块 |
| `src-tauri/src/keyboard_hook.rs` | 新建 | WH_KEYBOARD_LL 钩子模块 |
| `src-tauri/src/lib.rs` | 修改 | 注册新模块 |
| `src-tauri/src/main.rs` | 修改 | 替换 rdev 为新方案 |
| `src-tauri/Cargo.toml` | 修改（阶段三） | 移除 rdev 依赖 |

---

## 五、总结

| 维度 | 评估 |
|------|------|
| **必要性** | ✅ 有必要——作为游戏截图工具，DirectInput 独占模式下无法截图是核心缺陷 |
| **风险等级** | 🟡 中等——主要风险在去重逻辑和钩子稳定性，但都有成熟的解决方案 |
| **额外收益** | ✅ 可阻止 PrintScreen 传播，避免 Windows 自带截图叠加层 |
| **实施策略** | 🔄 分阶段——先双轨运行，确认稳定后再移除 rdev |
| **代码量** | 📦 约 200-300 行新增代码（两个新模块），main.rs 修改约 20 行 |
