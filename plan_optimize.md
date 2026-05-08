# 导出文件体积精简方案

## 一、体积过大的根因分析

### 1. 原始截图体积

| 配置 | 1080P 单张约 | 4K 单张约 | 默认值 |
|------|-------------|-----------|--------|
| WebP high (90) | ~500KB | ~1.2MB | |
| WebP medium (75) | ~300KB | ~700KB | **默认** |
| WebP low (50) | ~150KB | ~350KB | |
| PNG | ~3-5MB | ~10MB+ | |

### 2. 三大主要原因

**原因①：全分辨率原图直接嵌入（主要）**

`read_files_as_base64` 从磁盘读取的是完整的原始截图文件，不做任何缩放或压缩。1080P 的截图就是 1920×1080，4K 截图就是 3840×2160。但在导出场景中：

| 场景 | 实际展示尺寸 | 需要分辨率 | 浪费比例 |
|------|------------|-----------|---------|
| HTML 网格缩略图 | ~320px 宽 | 640px 足够 | 90%+ |
| HTML Lightbox 大图 | 屏幕大小 | 1920px 足够 | 0-50% |
| PDF 2张/页 | ~87mm 宽 | ~800px 足够 | 80%+ |
| PDF 8张/页 | ~43mm 宽 | ~400px 足够 | 95%+ |

**原因②：Base64 编码膨胀**

二进制数据转为 Base64 文本会膨胀约 **33%**。

> 例：300KB 的 WebP 文件 → ~400KB 的 Base64 字符串

**原因③：数量累积效应**

N 张截图的总大小 = 单张大小 × N × 1.33（Base64 膨胀）。20 张以上时体积迅速膨胀。

### 3. 典型场景估算

| 场景 | 截图数量 | 原始总大小 | Base64 后 | 导出文件 |
|------|---------|-----------|-----------|---------|
| WebP medium, 1080P | 10 张 | ~3MB | ~4MB | ~4MB+ |
| WebP medium, 1080P | 30 张 | ~9MB | ~12MB | ~12MB+ |
| WebP high, 4K | 10 张 | ~12MB | ~16MB | ~16MB+ |

---

## 二、精简方案

### 核心思路：在后端做一次缩放 + JPEG 压缩

新增一个 Rust 命令 `read_images_for_export`，替代当前的 `read_files_as_base64`：
1. 读取原图 → 2. 解码 → 3. **缩放到合理尺寸** → 4. **JPEG 压缩** → 5. 返回 Base64

### 方案选择对比

| 方案 | 实现复杂度 | 体积缩减 | 质量影响 | 推荐 |
|------|-----------|---------|---------|------|
| **A：均一缩放**（推荐） | 低 | 70-90% | 轻微，可接受 | ✅ |
| B：HTML 双轨（网格缩略+大图原图） | 高 | 50% | 无 | ❌ |
| C：前端 Canvas 缩放 | 中 | 30-50% | 中等 | ❌ |

**推荐方案 A** 的理由：
- 导出场景不要求像素级精度，视觉质量损失几乎不可察觉
- 实现简单，只需改动 Rust 后端一个命令
- 一次缩放，HTML 和 PDF 都受益
- 无需修改前端导出逻辑

### 缩放参数设计

| 参数 | 值 | 依据 |
|------|-----|------|
| 最大长边 | **1600px** | PDF A4 单页最大约 180mm（~850px @300dpi），1600px 有 2 倍余量；HTML Lightbox 全屏也足够 |
| 格式 | **JPEG** | 压缩率高、浏览器/PDF 兼容性好 |
| 质量 | **80** | 与 WebP medium (75) 视觉质量相当，文件更小 |
| DPI | 72 | PDF 输出时 jsPDF 按 mm 定位，像素数足够 |

### 预期效果对比

| 场景 | 改造前 | 改造后 | 缩减比例 |
|------|-------|-------|---------|
| 10张 1080P WebP medium | ~4MB | ~0.6-1MB | **~80%** |
| 30张 1080P WebP medium | ~12MB | ~1.8-3MB | **~80%** |
| 10张 4K WebP high | ~16MB | ~0.8-1.2MB | **~92%** |
| PDF 输出 | 同原始大小 | 大幅减小 | **70-90%** |

---

## 三、具体实施方案

### 3.1 Rust 后端：新增 `read_images_for_export` 命令

```rust
#[tauri::command]
fn read_images_for_export(paths: Vec<String>) -> Result<Vec<String>, String> {
    use base64::{Engine as _, engine::general_purpose};
    let mut results = Vec::new();
    for path_str in &paths {
        let path = std::path::Path::new(path_str);
        // 1. 读取原始文件
        let img = image::open(path)
            .map_err(|e| format!("打开图片失败 {}: {}", path_str, e))?;
        // 2. 等比例缩放，最大边 1600px
        let (w, h) = (img.width(), img.height());
        let max_dim = 1600u32;
        let resized = if w > max_dim || h > max_dim {
            if w >= h {
                let new_w = max_dim;
                let new_h = (h as u64 * max_dim as u64 / w as u64) as u32;
                img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3)
            } else {
                let new_h = max_dim;
                let new_w = (w as u64 * max_dim as u64 / h as u64) as u32;
                img.resize_exact(new_w, new_h, image::imageops::FilterType::Lanczos3)
            }
        } else {
            img
        };
        // 3. JPEG 编码，质量 80
        let mut buf = std::io::Cursor::new(Vec::new());
        resized.write_to(&mut buf, image::ImageFormat::Jpeg)
            .map_err(|e| format!("JPEG编码失败: {}", e))?;
        let jpeg_data = buf.into_inner();
        // 4. Base64 编码
        let b64 = general_purpose::STANDARD.encode(&jpeg_data);
        results.push(b64);
    }
    Ok(results)
}
```

关键点：
- 使用 `image::open` 自动处理 WebP/PNG/JPG 等所有输入格式
- `resize_exact` + `Lanczos3` 滤波器保证缩放质量
- 输出统一为 JPEG，质量 80
- JPEG MIME type 固定为 `image/jpeg`

### 3.2 前端 App.jsx：替换调用

将：
```js
const imagesBase64 = await invoke('read_files_as_base64', {
  paths: screenshotData.map(s => s.file_path)
})
```

改为：
```js
const imagesBase64 = await invoke('read_images_for_export', {
  paths: screenshotData.map(s => s.file_path)
})
```

### 3.3 HTTP 导出器 htmlExporter.js：适配统一 MIME

由于所有图片都变成了 JPEG，`getImageMimeType` 函数可以简化：

```js
function getImageMimeType() {
  return 'image/jpeg'
}
```

### 3.4 PDF 导出器：适配统一 MIME

同样，`doc.addImage` 的格式参数固定为 `'JPEG'`，无需再按原格式判断。

### 3.5 注册新命令

在 `main.rs` 的 `generate_handler!` 中：
- 新增 `read_images_for_export`
- 可保留 `read_files_as_base64`（向���兼容，但不再使用）

---

## 四、不采取的措施及理由

| 考虑过的方案 | 放弃原因 |
|------------|---------|
| 前端 Canvas 缩放后再编码 | 浏览器 Canvas 处理大图耗内存、耗 CPU；缩放质量不如后端 `Lanczos3` |
| 双轨制（缩略图+大图分开） | 复杂度高，HTML 需要两套数据；实际收益有限 |
| WebP 作为输出格式 | jsPDF 对 WebP 兼容性差；JPEG 在所有 PDF 阅读器中表现一致 |
| 动态质量（根据图片数调整） | 过度设计，固定质量 80 已足够 |
| 增量缓存 | 导出是一次性操作，缓存收益低 |
