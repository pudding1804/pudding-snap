# 方案：添加"手动输入"游戏信息功能

## 需求概述

在"更改信息"菜单中增加"手动输入"选项（与 Steam、Bangumi 并列），允许用户：
1. 手动输入游戏名称
2. 上传本地图片或从剪贴板粘贴图片作为游戏缩略图
3. 保存后更新数据库，后续截图不再自动匹配 Steam

## 现有架构分析

### "更改信息"菜单流程
```
GameDetail 三点菜单 → "更改信息" → App.jsx 搜索模态框
  Step 1 (source): 选择 Steam / Bangumi
  Step 2 (search): 输入关键词搜索
  Step 3 (results): 选择结果并应用
```

搜索模态框当前直接内联在 App.jsx 中（约 260 行），已经比较臃肿。

### 游戏缩略图显示机制
- `steam_logo_path`：Steam logo，使用 `objectFit: 'contain'` 填满整个 gameIcon 区域（94x176px 或 71x126px）
- `game_icon_path`：本地图标，使用 48x48 容器 + `objectFit: 'cover'`
- 优先级：`steam_logo_path` > `game_icon_path` > 文字 fallback

### 图片保存机制
- Steam logo 保存到 `data_dir/steam_logos/steam_{appid}.jpg`
- Base64 图片保存：`save_share_image` 命令（解码 Base64 写入文件）
- 缩略图生成：`create_thumbnail()` 等比缩放

### 数据库字段
`game_cache` 表关键字段：
- `display_title`：显示名称
- `steam_logo_path`：缩略图路径（Steam logo 或手动上传的图片）
- `steam_match_status`：匹配状态（设为 `"manual"` 表示手动匹配，跳过自动匹配）

## 实现方案

### 核心设计

1. **新建独立组件** `ManualInfoModal.jsx`，避免 App.jsx 继续膨胀
2. **复用 `steam_logo_path` 字段**存储手动上传的缩略图（与 Steam logo 共用显示逻辑）
3. **`steam_match_status = "manual"`** 标记手动匹配，阻止后续自动匹配
4. **图片处理**：上传/粘贴后缩放为合适尺寸保存，确保在游戏列表中正确显示

### 新增文件

#### 1. `src/components/ManualInfoModal.jsx` — 手动输入模态框组件

**Props 接口：**
```jsx
{
  theme, styles, t,           // 主题、样式、国际化
  show,                       // 是否显示
  gameId,                     // 当前游戏 ID
  currentTitle,               // 当前显示标题
  onClose,                    // 关闭回调
  onSaved,                    // 保存成功回调 (updatedGame) => void
}
```

**UI 结构：**
```
┌─────────────────────────────────┐
│  手动输入游戏信息                 │
│                                 │
│  游戏名称                        │
│  ┌─────────────────────────┐    │
│  │ 输入游戏名称              │    │
│  └─────────────────────────┘    │
│                                 │
│  游戏缩略图                      │
│  ┌─────────────────────────┐    │
│  │                         │    │
│  │    预览区域 / 拖放区域    │    │
│  │   (460x215, 16:9)       │    │
│  │                         │    │
│  └─────────────────────────┘    │
│  [选择本地图片]  [粘贴剪贴板图片]  │
│  提示: 也可按 Ctrl+V 粘贴图片     │
│                                 │
│  [取消]            [保存]        │
└─────────────────────────────────┘
```

**功能实现：**

1. **游戏名称输入**：`<input>` 组件，默认填入当前 `display_title`

2. **本地图片选择**：使用 `@tauri-apps/plugin-dialog` 的 `open()` API（与 ImportModal 相同）
   ```js
   import { open } from '@tauri-apps/plugin-dialog'
   const selected = await open({
     multiple: false,
     filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'] }]
   })
   ```

3. **剪贴板粘贴**：
   - 监听 `paste` 事件读取剪贴板图片
   - 使用 `navigator.clipboard.read()` 读取图片 Blob
   - 转为 Base64 传给后端保存
   - 同时支持 Ctrl+V 快捷键

4. **图片预览**：在预览区域显示已选择/粘贴的图片

5. **保存逻辑**：
   - 调用后端 `save_manual_game_info` 命令
   - 传入 `gameId`、`displayName`、图片数据（Base64 或本地路径）
   - 后端负责：缩放图片 → 保存到 `steam_logos` 目录 → 更新数据库

#### 2. 后端新增 Tauri 命令：`save_manual_game_info`

```rust
#[tauri::command]
fn save_manual_game_info(
    game_id: String,
    display_name: String,
    image_source: Option<String>,  // "file" 或 "clipboard"
    image_data: Option<String>,    // 本地文件路径 或 Base64 数据
    state: State<AppState>,
) -> Result<GameSummary, String>
```

**处理逻辑：**
1. 如果 `image_source == "file"`：读取本地图片文件
2. 如果 `image_source == "clipboard"`：Base64 解码图片数据
3. 使用 `image` crate 打开图片
4. 缩放为合适尺寸（最大宽度 460px，保持宽高比，与 Steam header_image 接近）
5. 保存为 JPG 到 `steam_logos/manual_{game_id}.jpg`
6. 更新数据库：
   - `display_title` = 用户输入的名称
   - `steam_name` = 用户输入的名称
   - `steam_logo_path` = 保存的图片路径
   - `steam_match_status` = "manual"
7. 返回更新后的 `GameSummary`

### 修改文件

#### 3. `src/App.jsx` — 集成新组件

**修改点：**
- 在搜索模态框的 source 步骤中添加"手动输入"按钮
- 点击后关闭搜索模态框，打开 ManualInfoModal
- 添加 `showManualInfoModal` 状态
- 渲染 ManualInfoModal 组件
- 保存成功后刷新游戏列表

**source 步骤新增按钮：**
```jsx
<button onClick={() => {
  setShowSearchModal(false)
  setShowManualInfoModal(true)
}}>
  <svg><!-- 编辑图标 --></svg>
  {t.search.manual_input}
</button>
```

#### 4. `src/i18n/translations.js` — 添加国际化文本

```js
// zh
manual_input: '手动输入',
manual_input_title: '手动输入游戏信息',
game_name: '游戏名称',
game_thumbnail: '游戏缩略图',
select_local_image: '选择本地图片',
paste_clipboard: '粘贴剪贴板图片',
paste_hint: '也可按 Ctrl+V 粘贴图片',
drag_drop_hint: '拖放图片到此处',
no_image_selected: '未选择图片（可选）',
save: '保存',
cancel: '取消',
save_success: '游戏信息已保存',

// en
manual_input: 'Manual Input',
manual_input_title: 'Manual Game Info Input',
game_name: 'Game Name',
game_thumbnail: 'Game Thumbnail',
select_local_image: 'Select Local Image',
paste_clipboard: 'Paste from Clipboard',
paste_hint: 'You can also press Ctrl+V to paste',
drag_drop_hint: 'Drop image here',
no_image_selected: 'No image selected (optional)',
save: 'Save',
cancel: 'Cancel',
save_success: 'Game info saved',

// ja
manual_input: '手動入力',
manual_input_title: 'ゲーム情報の手動入力',
game_name: 'ゲーム名',
game_thumbnail: 'ゲームサムネイル',
select_local_image: 'ローカル画像を選択',
paste_clipboard: 'クリップボードから貼り付け',
paste_hint: 'Ctrl+Vで画像を貼り付けることもできます',
drag_drop_hint: 'ここに画像をドロップ',
no_image_selected: '画像未選択（オプション）',
save: '保存',
cancel: 'キャンセル',
save_success: 'ゲーム情報を保存しました',
```

#### 5. `src-tauri/src/main.rs` — 注册新命令

在 `invoke_handler` 中注册 `save_manual_game_info`。

#### 6. `src-tauri/src/database.rs` — 新增数据库操作函数

```rust
pub fn set_manual_game_info(conn: &Connection, game_id: &str, display_name: &str, logo_path: Option<&str>) -> Result<()> {
    let timestamp = chrono::Utc::now().timestamp();
    conn.execute(
        "UPDATE game_cache SET display_title = ?1, steam_name = ?2, steam_logo_path = ?3, steam_match_status = 'manual', last_updated = ?4 WHERE game_id = ?5",
        params![display_name, display_name, logo_path, timestamp, game_id],
    )?;
    Ok(())
}
```

### 自动匹配跳过逻辑

当前自动匹配逻辑在 `main.rs` 的截图处理流程中，通过 `is_existing` 判断是否跳过 Steam 匹配。需要增加对 `steam_match_status = "manual"` 的检查：

在 `if !is_existing` 判断之前，先检查 `steam_match_status`：
```rust
let should_skip_steam = db::get_game_cache(&conn, &game_id)
    .and_then(|c| c.steam_match_status)
    .map(|s| s == "manual" || s == "found")
    .unwrap_or(false);

if !is_existing && !should_skip_steam {
    // 执行 Steam 匹配...
}
```

### 图片尺寸处理策略

手动上传的图片需要缩放为适合游戏列表显示的尺寸：

- **目标尺寸**：最大宽度 460px，最大高度 215px（接近 Steam header_image 的 460x215 比例）
- **缩放方式**：等比缩放，使用 `image::DynamicImage::thumbnail()`
- **保存格式**：JPG，质量 85
- **保存路径**：`{data_dir}/steam_logos/manual_{game_id}.jpg`

这样在 GameList 中显示时，`steam_logo_path` 有值，会使用 `objectFit: 'contain'` 的 `gameLogoImage` 样式，与 Steam logo 显示方式一致，任何尺寸的图片都能正确显示。

### 实施步骤

1. **database.rs**：新增 `set_manual_game_info()` 函数
2. **main.rs**：新增 `save_manual_game_info` Tauri 命令 + 注册 + 修改自动匹配跳过逻辑
3. **translations.js**：添加三语国际化文本
4. **ManualInfoModal.jsx**：新建手动输入模态框组件
5. **App.jsx**：集成新组件（添加状态、按钮、渲染）
6. **编译验证**
