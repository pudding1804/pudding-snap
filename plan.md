# 批量分享功能实施方案

## 一、功能概述

将 GameDetail 窗体右上角三点菜单中的"多选删除"改造为"批量操作"模式，新增全选、分享功能。分享支持 HTML 和 PDF 两种格式输出，输出的文件包含游戏名、评分、截图及附注信息。

---

## 二、涉及文件清单

| 文件 | 修改类型 | 说明 |
|------|----------|------|
| `src/components/GameDetail.jsx` | 修改 | 三点菜单文案、多选模式按钮栏改造 |
| `src/App.jsx` | 修改 | 新增状态管理、事件处理函数、新组件挂载 |
| `src/i18n/translations.js` | 修改 | 新增/修改翻译键（zh/en/ja） |
| `src/components/BatchShareModal.jsx` | **新建** | 批量分享弹窗组件 |
| `src/utils/htmlExporter.js` | **新建** | HTML 导出生成器 |
| `src/utils/pdfExporter.js` | **新建** | PDF 导出生成器 |
| `src-tauri/src/main.rs` | 修改 | 新增 Rust 命令 |
| `src-tauri/src/database.rs` | 修改 | 新增数据库查询函数 |
| `package.json` | 修改 | 新增 jspdf 依赖 |

---

## 三、详细实施方案

### 3.1 翻译键更新（translations.js）

#### 修改的翻译键

| 原键路径 | 原中文 | 新中文 | 新英文 | 新日文 |
|----------|--------|--------|--------|--------|
| `header.multi_select` | 多选删除 | 批量操作 | Batch Operations | 一括操作 |
| `header.cancel_select` | 取消选定 | 取消 | Cancel | キャンセル |
| `header.confirm_delete` | 确定删除 | 删除 | Delete | 削除 |

#### 新增的翻译键

| 键路径 | 中文 | 英文 | 日文 |
|--------|------|------|------|
| `header.select_all` | 全选 | Select All | 全選 |
| `header.share` | 分享 | Share | 共有 |
| `batch_share.title` | 批量分享 | Batch Share | 一括共有 |
| `batch_share.format` | 导出格式 | Export Format | エクスポート形式 |
| `batch_share.html` | 网页 (HTML) | Web Page (HTML) | ウェブページ (HTML) |
| `batch_share.pdf` | PDF 文档 | PDF Document | PDF文書 |
| `batch_share.images_per_page` | 每页图片数 | Images Per Page | ページあたりの画像数 |
| `batch_share.export` | 导出 | Export | エクスポート |
| `batch_share.exporting` | 正在生成... | Generating... | 生成中... |
| `batch_share.export_success` | 导出成功 | Export Successful | エクスポート成功 |
| `batch_share.export_failed` | 导出失败 | Export Failed | エクスポート失敗 |
| `batch_share.no_selection` | 请先选择截图 | Please select screenshots first | スクリーンショットを選択してください |
| `batch_share.selected_count` | 已选 {count} 张 | {count} selected | {count}枚選択 |
| `batch_share.game_title` | 游戏名 | Game | ゲーム |
| `batch_share.rating` | 评分 | Rating | 評価 |
| `batch_share.note` | 附注 | Note | メモ |
| `batch_share.time` | 截图时间 | Time | 撮影時間 |
| `batch_share.no_note` | 无附注 | No note | メモなし |

---

### 3.2 GameDetail.jsx 修改

#### 3.2.1 三点菜单项文案修改

将菜单中的"多选删除"项文案改为 `t.header.multi_select`（已更新为"批量操作"），图标保持不变。

**修改位置**：第 411-424 行的菜单项区域

#### 3.2.2 多选模式按钮栏改造

**原布局**（第 221-234 行）：
```
[取消选定]  [确定删除 (N)]
```

**新布局**：
```
[取消]  [全选]  [分享]  [删除 (N)]
```

具体实现：
- **取消按钮**：调用 `onToggleMultiSelect(false)`，退出多选模式
- **全选按钮**：调用 `onSelectAll()`，选中当前游戏的所有截图（跨页）
- **分享按钮**：调用 `onBatchShare()`，打开分享弹窗；未选中任何截图时 disabled
- **删除按钮**：调用 `onSelectScreenshot('delete')`，同原逻辑；未选中时 disabled

按钮样式参考现有 `styles.btn` / `styles.btnDanger`，分享按钮使用 `theme.primary` 背景色。

---

### 3.3 App.jsx 状态管理修改

#### 3.3.1 新增状态

```javascript
const [showBatchShareModal, setShowBatchShareModal] = useState(false)
```

#### 3.3.2 新增事件处理函数

**1. `handleSelectAllScreenshots`** — 全选所有截图

```javascript
const handleSelectAllScreenshots = useCallback(async () => {
  const gameId = selectedGameRef.current?.game_id
  try {
    const ids = await invoke('get_all_screenshot_ids', { gameId })
    setSelectedScreenshots(ids)
  } catch (e) {
    addLog(`获取截图ID失败: ${e}`)
  }
}, [addLog])
```

**2. `handleBatchShare`** — 打开批量分享弹窗

```javascript
const handleBatchShare = useCallback(() => {
  if (selectedScreenshots.length === 0) return
  setShowBatchShareModal(true)
}, [selectedScreenshots])
```

**3. `handleBatchShareExport`** — 执行批量分享导出

```javascript
const handleBatchShareExport = useCallback(async (format, imagesPerPage) => {
  // 1. 从后端获取选中截图的完整数据
  const screenshotData = await invoke('get_screenshots_by_ids', { ids: selectedScreenshots })
  // 2. 从后端读取图片文件的 base64 数据
  const imagesBase64 = await invoke('read_files_as_base64', { 
    paths: screenshotData.map(s => s.file_path) 
  })
  // 3. 根据格式生成内容
  let content, ext, mimeType
  if (format === 'html') {
    content = generateHtmlExport(screenshotData, imagesBase64, selectedGame, t)
    ext = 'html'
    mimeType = 'text/html'
  } else {
    content = await generatePdfExport(screenshotData, imagesBase64, selectedGame, t, imagesPerPage)
    ext = 'pdf'
    mimeType = 'application/pdf'
  }
  // 4. 弹出保存对话框
  const { save } = await import('@tauri-apps/plugin-dialog')
  const filePath = await save({
    defaultPath: `${selectedGame?.display_title || 'export'}_screenshots.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  })
  if (filePath) {
    await invoke('save_export_file', { filePath, content, format })
    showNotification(t.batch_share?.export_success || '导出成功')
  }
}, [selectedScreenshots, selectedGame, showNotification, t])
```

#### 3.3.3 传递新 props 给 GameDetail

在 GameDetail 组件调用处（约第 1896-1954 行）新增 props：

```jsx
onSelectAll={handleSelectAllScreenshots}
onBatchShare={handleBatchShare}
```

同时修改 `onSelectScreenshot` 回调，增加 `'share'` action 支持（可选，也可直接用 onBatchShare）。

#### 3.3.4 挂载 BatchShareModal 组件

在 App.jsx 的渲染区域，与其他 Modal 同级位置添加：

```jsx
{showBatchShareModal && (
  <BatchShareModal
    theme={theme}
    styles={styles}
    t={t}
    selectedCount={selectedScreenshots.length}
    onExport={handleBatchShareExport}
    onClose={() => setShowBatchShareModal(false)}
  />
)}
```

---

### 3.4 BatchShareModal 组件（新建）

**文件**：`src/components/BatchShareModal.jsx`

**功能**：
- 显示已选截图数量
- 格式选择：HTML / PDF（单选按钮组）
- 当选择 PDF 时，显示"每页图片数"下拉菜单（2/4/6/8）
- 导出按钮
- 导出进度提示

**UI 布局**：

```
┌─────────────────────────────────┐
│  批量分享                    ×  │
├─────────────────────────────────┤
│                                 │
│  已选 12 张截图                 │
│                                 │
│  导出格式                       │
│  [网页 (HTML)]  [PDF 文档]      │
│                                 │
│  每页图片数  (仅PDF时显示)      │
│  [4 ▼]                         │
│                                 │
│  ─────────────────────────────  │
│                                 │
│        [导出]                   │
│                                 │
└─────────────────────────────────┘
```

**核心逻辑**：
- `format` 状态：`'html'` | `'pdf'`，默认 `'html'`
- `imagesPerPage` 状态：`2 | 4 | 6 | 8`，默认 `4`
- 点击导出时调用 `onExport(format, imagesPerPage)`

---

### 3.5 HTML 导出生成器（新建）

**文件**：`src/utils/htmlExporter.js`

**导出函数**：`generateHtmlExport(screenshots, imagesBase64, gameInfo, t)`

**HTML 结构设计**：

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>{游戏名} - 截图集</title>
  <style>
    /* 使用应用当前主题色系的内联样式 */
    /* 响应式网格布局 */
    /* 缩略图卡片样式 */
    /* Lightbox 弹窗样式 */
  </style>
</head>
<body>
  <!-- 标题区域：游戏名 + 评分 -->
  <header>
    <h1>{游戏名}</h1>
    <div class="rating">★ {评分}/10</div>
  </header>

  <!-- 截图网格 -->
  <div class="gallery">
    {screenshots.map(ss => (
      <div class="screenshot-card">
        <img src="data:image/..." 
             class="thumbnail" 
             onclick="openLightbox(index)" />
        <div class="meta">
          <p class="note">{附注 || '无附注'}</p>
          <p class="time">{截图时间}</p>
        </div>
      </div>
    ))}
  </div>

  <!-- Lightbox 弹窗 -->
  <div id="lightbox" onclick="closeLightbox()">
    <img id="lightbox-img" />
  </div>

  <script>
    // Lightbox 交互逻辑
    function openLightbox(index) { ... }
    function closeLightbox() { ... }
    // 键盘导航：← → 切换图片，Esc 关闭
  </script>
</body>
</html>
```

**关键设计点**：
1. **图片嵌入**：所有图片以 base64 data URL 内嵌，确保单文件可移植
2. **缩略图网格**：CSS Grid 布局，`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`，自适应不同屏幕
3. **统一显示比例**：缩略图区域设置固定宽高比（如 16:9），`object-fit: cover` 裁剪，确保视觉统一
4. **Lightbox 查看大图**：点击缩略图弹出全屏大图，支持左右键切换、Esc 关闭
5. **元信息显示**：每张截图下方显示附注和时间，附注为空时显示"无附注"
6. **主题风格**：深色背景 + 卡片式布局，与应用现有风格一致

---

### 3.6 PDF 导出生成器（新建）

**文件**：`src/utils/pdfExporter.js`

**依赖**：`jspdf`（需新增 npm 依赖）

**安装**：`npm install jspdf`

**导出函数**：`generatePdfExport(screenshots, imagesBase64, gameInfo, t, imagesPerPage)`

**PDF 布局设计**：

```
A4 尺寸：210mm × 297mm
页边距：15mm
可用区域：180mm × 267mm

第1页（标题页）：
┌─────────────────────────────────┐
│                                 │
│        {游戏名}                 │  ← 大标题，居中
│        ★ 评分: 8/10             │  ← 评分，居中
│        共 N 张截图               │  ← 截图数量
│                                 │
│  ┌──────┐  ┌──────┐            │
│  │ 图1  │  │ 图2  │            │  ← 根据每页图片数排列
│  │      │  │      │            │
│  ├──────┤  ├──────┤            │
│  │附注  │  │附注  │            │
│  │时间  │  │时间  │            │
│  └──────┘  └──────┘            │
│                                 │
└─────────────────────────────────┘

后续页（无标题，纯截图）：
┌─────────────────────────────────┐
│  ┌──────┐  ┌──────┐            │
│  │ 图N  │  │ 图N+1│            │
│  │      │  │      │            │
│  ├──────┤  ├──────┤            │
│  │附注  │  │附注  │            │
│  │时间  │  │时间  │            │
│  └──────┘  └──────┘            │
│  ┌──────┐  ┌──────┐            │
│  │ 图N+2│  │ 图N+3│            │
│  ...                            │
└─────────────────────────────────┘
```

**不同每页图片数的布局**：

| 每页图片数 | 列数 | 行数 | 单图尺寸（约） |
|-----------|------|------|---------------|
| 2 | 1 | 2 | 180mm × 120mm |
| 4 | 2 | 2 | 87mm × 120mm |
| 6 | 2 | 3 | 87mm × 78mm |
| 8 | 2 | 4 | 87mm × 58mm |

**统一显示比例策略**：
- 每张图片分配固定大小的区域（宽 × 高）
- 图片在区域内 `object-fit: contain` 等比缩放，居中显示
- 不同分辨率的图片保持原始宽高比，不会变形
- 区域背景色为浅灰色，与图片形成对比

**CJK 文字处理**：
- jsPDF 默认不支持中文等 CJK 字符
- **方案**：将文字部分（游戏名、附注、时间）先渲染到 Canvas 上，再将 Canvas 作为图片嵌入 PDF
- 这样无需嵌入字体文件，且保证所有语言正确显示
- 具体实现：创建离屏 Canvas → 绘制文字 → `canvas.toDataURL()` → `jsPDF.addImage()`

**核心流程**：
1. 创建 jsPDF 实例，A4 纵向
2. 第1页绘制标题区域（游戏名 + 评分 + 截图数量）
3. 计算每页图片布局位置
4. 逐张添加图片和文字：
   a. 加载 base64 图片，获取原始尺寸
   b. 计算在分配区域内的缩放和位置（contain 模式）
   c. 添加图片
   d. 在图片下方添加附注和时间（Canvas 渲染文字后作为图片嵌入）
5. 超过一页时自动分页
6. 返回 PDF 的 base64 数据

---

### 3.7 Rust 后端修改

#### 3.7.1 新增命令：`get_all_screenshot_ids`

**功能**：获取指定游戏的所有截图 ID（不分页），用于全选功能。

**位置**：`main.rs` 或 `commands/screenshot.rs`

```rust
#[tauri::command]
fn get_all_screenshot_ids(game_id: Option<String>, state: State<AppState>) -> Result<Vec<i32>, String> {
    let conn = state.db.lock().unwrap();
    db::get_all_screenshot_ids(&conn, game_id.as_deref())
        .map_err(|e| e.to_string())
}
```

**数据库函数**（`database.rs`）：

```rust
pub fn get_all_screenshot_ids(conn: &Connection, game_id: Option<&str>) -> Result<Vec<i32>> {
    let mut sql = String::from("SELECT id FROM screenshots");
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    
    if let Some(gid) = game_id {
        sql.push_str(" WHERE game_id = ?");
        params.push(Box::new(gid.to_string()));
    }
    
    sql.push_str(" ORDER BY timestamp ASC");
    
    let mut stmt = conn.prepare(&sql)?;
    let ids: Vec<i32> = stmt.query_map(params.as_slice(), |row| row.get(0))?
        .filter_map(|r| r.ok())
        .collect();
    Ok(ids)
}
```

#### 3.7.2 新增命令：`get_screenshots_by_ids`

**功能**：根据 ID 列表获取截图完整数据，用于导出时获取选中截图的信息。

```rust
#[tauri::command]
fn get_screenshots_by_ids(ids: Vec<i32>, state: State<AppState>) -> Result<Vec<ScreenshotRecord>, String> {
    let conn = state.db.lock().unwrap();
    db::get_screenshots_by_ids(&conn, &ids)
        .map_err(|e| e.to_string())
}
```

**数据库函数**：

```rust
pub fn get_screenshots_by_ids(conn: &Connection, ids: &[i32]) -> Result<Vec<ScreenshotRecord>> {
    if ids.is_empty() { return Ok(Vec::new()); }
    let placeholders = ids.iter().map(|_| "?").collect::<Vec<_>>().join(",");
    let sql = format!(
        "SELECT s.id, s.file_path, s.thumbnail_path, s.game_id, s.game_title, \
         COALESCE(s.display_title, s.game_title), s.timestamp, s.note, s.game_banner_url \
         FROM screenshots s WHERE s.id IN ({}) ORDER BY s.timestamp ASC", 
        placeholders
    );
    let params: Vec<&dyn rusqlite::types::ToSql> = ids.iter().map(|id| id as &dyn rusqlite::types::ToSql).collect();
    // ... 查询并返回 Vec<ScreenshotRecord>
}
```

#### 3.7.3 新增命令：`read_files_as_base64`

**功能**：批量读取文件并返回 base64 编码数据，用于导出时嵌入图片。

```rust
#[tauri::command]
fn read_files_as_base64(paths: Vec<String>) -> Result<Vec<String>, String> {
    use base64::{Engine as _, engine::general_purpose};
    let mut results = Vec::new();
    for path in paths {
        let data = std::fs::read(&path)
            .map_err(|e| format!("读取文件失败 {}: {}", path, e))?;
        let b64 = general_purpose::STANDARD.encode(&data);
        results.push(b64);
    }
    Ok(results)
}
```

#### 3.7.4 新增命令：`save_export_file`

**功能**：保存导出文件（HTML 文本或 PDF 二进制数据）。

```rust
#[tauri::command]
fn save_export_file(file_path: String, content: String, format: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("创建目录失败: {}", e))?;
    }
    
    if format == "pdf" {
        // content 是 base64 编码的 PDF 数据
        use base64::{Engine as _, engine::general_purpose};
        let decoded = general_purpose::STANDARD.decode(&content)
            .map_err(|e| format!("Base64解码失败: {}", e))?;
        std::fs::write(path, decoded)
            .map_err(|e| format!("写入文件失败: {}", e))?;
    } else {
        // HTML 直接写入文本
        std::fs::write(path, content.as_bytes())
            .map_err(|e| format!("写入文件失败: {}", e))?;
    }
    Ok(())
}
```

#### 3.7.5 注册新命令

在 `main.rs` 的 `.invoke_handler(tauri::generate_handler![...])` 中添加：
- `get_all_screenshot_ids`
- `get_screenshots_by_ids`
- `read_files_as_base64`
- `save_export_file`

---

### 3.8 NPM 依赖更新

**新增**：`jspdf`

```bash
npm install jspdf
```

---

## 四、实施步骤（按顺序）

### 第1步：翻译键更新
修改 `src/i18n/translations.js`，更新现有键值并新增所有翻译键。

### 第2步：Rust 后端新增命令
1. 在 `database.rs` 中新增 `get_all_screenshot_ids` 和 `get_screenshots_by_ids` 函数
2. 在 `main.rs` 中新增 `get_all_screenshot_ids`、`get_screenshots_by_ids`、`read_files_as_base64`、`save_export_file` 命令
3. 在 `main.rs` 的命令注册列表中添加新命令

### 第3步：GameDetail.jsx UI 改造
1. 修改三点菜单项文案
2. 改造多选模式按钮栏（取消/全选/分享/删除）
3. 新增 `onSelectAll` 和 `onBatchShare` prop 接收

### 第4步：App.jsx 状态管理
1. 新增 `showBatchShareModal` 状态
2. 新增 `handleSelectAllScreenshots`、`handleBatchShare`、`handleBatchShareExport` 函数
3. 向 GameDetail 传递新 props
4. 挂载 BatchShareModal 组件

### 第5步：BatchShareModal 组件
1. 创建 `src/components/BatchShareModal.jsx`
2. 实现格式选择（HTML/PDF）
3. 实现 PDF 每页图片数选择
4. 实现导出按钮和进度提示

### 第6步：HTML 导出生成器
1. 创建 `src/utils/htmlExporter.js`
2. 实现自包含 HTML 生成（base64 图片、内联 CSS/JS）
3. 实现缩略图网格 + Lightbox 大图查看
4. 实现元信息（附注、时间）显示

### 第7步：PDF 导出生成器
1. 安装 jspdf 依赖
2. 创建 `src/utils/pdfExporter.js`
3. 实现 A4 页面布局计算
4. 实现图片等比缩放和定位
5. 实现 CJK 文字 Canvas 渲染方案
6. 实现自动分页

### 第8步：集成测试
1. 测试全选功能（跨页选择）
2. 测试 HTML 导出（打开验证布局和交互）
3. 测试 PDF 导出（不同每页图片数）
4. 测试中英文混排显示
5. 测试不同分辨率图片的统一显示效果

---

## 五、技术要点与风险

### 5.1 图片 base64 编码的内存风险
- 大量高分辨率截图的 base64 数据可能占用大量内存
- **缓解措施**：分批处理图片，每次只处理当前页需要的图片；PDF 生成时逐页处理

### 5.2 PDF 中 CJK 文字渲染
- jsPDF 默认不支持 CJK 字符
- **方案**：使用离屏 Canvas 渲染文字为图片，再嵌入 PDF
- **优点**：无需嵌入字体文件，所有语言通用
- **缺点**：PDF 中文字不可选择/搜索（对于截图集文档可接受）

### 5.3 HTML 文件体积
- 所有图片以 base64 内嵌，文件可能较大
- **缓解措施**：在导出前对图片进行适当压缩/缩放（可选优化项，首期可不做）

### 5.4 全选性能
- 如果某游戏有数千张截图，全选后选中数千个 ID
- **缓解措施**：`selectedScreenshots` 数组仅存储 ID（i32），内存占用可控；导出时再按需加载数据
