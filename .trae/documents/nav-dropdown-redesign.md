# 导航系统重构计划：侧边栏 → 悬浮下拉菜单

## 概述

将当前左侧固定侧边栏（`Sidebar.jsx`）替换为基于悬浮触发的下拉菜单导航系统。新导航将集成到标题栏左上角区域，以"按时间浏览"按钮作为触发入口，悬浮时展开包含四个导航选项的下拉菜单。

***

## 现有架构分析

### 当前布局结构

```
<ErrorBoundary>
  <div (flex column)>
    <TitleBar />                    ← 标题栏（高度 32px）
    <div (flex row, flex: 1)>
      <Sidebar />                   ← 左侧固定侧边栏（48-200px 宽）
      <main (flex: 1)>             ← 主内容区
    </div>
  </div>
</ErrorBoundary>
```

### 导航状态管理

* `currentView` 状态控制视图切换：`'time'` | `'games'` | `'game-detail'` | `'recycle-bin'` | `'settings'`

* 三个专用切换函数：`switchToTimeView()`、`switchToGames()`、`switchToRecycleBin()`

* `settings` 直接通过 `setCurrentView('settings')` 切换

* `sidebarCollapsed` 状态 + `localStorage` 持久化

### 关键约束

* 样式方案：内联样式（JS 对象），无 CSS 文件

* 主题系统：5 个主题，通过 `theme` 对象传递颜色

* 国际化：`t.nav.time`、`t.nav.games`、`t.nav.recycle_bin`、`t.nav.settings`

* 回收站徽章：`recycleBinCount` 显示红色计数

***

## 实施步骤

### 步骤 1：创建 `NavDropdown.jsx` 组件

**文件**：`src/components/NavDropdown.jsx`（新建）

创建悬浮下拉菜单导航组件，替代原有 Sidebar。

#### 组件接口设计

```jsx
export function NavDropdown({
  theme,        // 主题对象
  currentView,  // 当前视图名
  t,            // 国际化翻译对象
  recycleBinCount = 0,  // 回收站计数
  onNavigate    // 导航回调 (viewName) => void
})
```

#### 核心实现要点

1. **触发按钮**：显示当前视图名称（如"按时间浏览"），带下拉箭头图标
2. **悬浮触发逻辑**：

   * 使用 `useState` 管理 `isOpen` 状态

   * 使用 `useRef` + `useEffect` 管理延迟定时器

   * 鼠标进入触发区域 → 200ms 延迟后打开（< 300ms 要求）

   * 鼠标离开菜单区域 → 300ms 延迟后关闭

   * 鼠标在延迟期间重新进入 → 取消关闭定时器
3. **下拉菜单面板**：

   * 绝对定位，位于触发按钮下方

   * 包含 4 个导航项：按时间浏览、按游戏浏览、回收站、设置

   * 回收站项右侧显示红色计数徽章

   * 当前选中项左侧显示高亮条（`theme.primary` 颜色，3px 宽）
4. **过渡动画**：

   * 使用 CSS `transition` 实现淡入淡出 + 向下滑移

   * `opacity: 0 → 1`，`transform: translateY(-8px) → translateY(0)`

   * 动画时长 0.2s，缓动函数 `ease-out`

   * 关闭时反向动画：`opacity: 1 → 0`，`transform: translateY(0) → translateY(-8px)`
5. **悬停反馈**：

   * 菜单项 hover 时背景色变为 `theme.accent`

   * 添加轻微左移效果 `translateX(2px)`，过渡 0.15s
6. **点击行为**：

   * 点击菜单项 → 调用 `onNavigate(viewName)` → 自动收起菜单
7. **键盘访问**：

   * 触发按钮支持 `Tab` 聚焦和 `Enter`/`Space` 开关菜单

   * 菜单打开时，`Tab`/`Shift+Tab` 在菜单项间导航

   * `Enter`/`Space` 选择当前聚焦菜单项

   * `Escape` 关闭菜单

   * 使用 `role="menu"` / `role="menuitem"` ARIA 属性
8. **点击外部关闭**：

   * 使用 `useEffect` 监听 `mousedown` 事件

   * 点击菜单外部区域时关闭菜单

#### 视觉设计规范

| 元素    | 样式                                                                                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 触发按钮  | `padding: 6px 12px`，`borderRadius: 6px`，`background: transparent`，hover 时 `background: theme.accent`                                     |
| 下拉面板  | `background: theme.card`，`borderRadius: 8px`，`boxShadow: 0 4px 16px rgba(0,0,0,0.15)`，`border: 1px solid theme.border`，`minWidth: 180px` |
| 菜单项   | `padding: 10px 16px`，`fontSize: 14px`，`fontFamily: system-ui, sans-serif`，`cursor: pointer`，`borderRadius: 6px`                          |
| 选中标识  | 左侧 3px 宽高亮条，颜色 `theme.primary`，`borderRadius: 2px`                                                                                       |
| 回收站徽章 | 红色背景 `#e74c3c`，白色文字，`borderRadius: 10px`，`fontSize: 11px`                                                                                |

***

### 步骤 2：修改 `TitleBar.jsx` — 集成导航下拉菜单

**文件**：`src/components/TitleBar.jsx`（修改）

将 `NavDropdown` 组件嵌入标题栏左侧区域，替代原有"PuddingSnap"文字旁的位置。

#### 修改内容

1. **更新组件接口**：增加 `currentView`、`t`、`recycleBinCount`、`onNavigate` props

   ```jsx
   export function TitleBar({ theme, t, onCloseConfirm, currentView, recycleBinCount, onNavigate })
   ```

2. **布局调整**：在标题栏左侧区域，将 `NavDropdown` 放置在 "PuddingSnap" 应用名右侧

   ```
   [PuddingSnap] [▼ 按时间浏览]          [最小化] [最大化] [关闭]
   ```

3. **样式微调**：确保导航按钮与标题栏高度（32px）协调，垂直居中

***

### 步骤 3：修改 `App.jsx` — 移除侧边栏，集成新导航

**文件**：`src/App.jsx`（修改）

#### 修改内容

1. **导入** **`NavDropdown`**：在组件导入区添加
2. **移除** **`Sidebar`** **组件引用**：

   * 从 `<div style={{ display: 'flex', flex: 1 }}>` 中移除 `<Sidebar />`

   * 移除 `sidebarCollapsed` 相关 state 和 `toggleSidebar` 函数

   * 移除 `localStorage` 中 `sidebarCollapsed` 的读写
3. **更新** **`TitleBar`** **props**：传入 `currentView`、`t`、`recycleBinCount`、`onNavigate`

   ```jsx
   <TitleBar
     theme={theme}
     t={t}
     onCloseConfirm={() => setShowCloseConfirm(true)}
     currentView={currentView}
     recycleBinCount={recycleBinCount}
     onNavigate={(view) => {
       if (view === 'time') switchToTimeView()
       else if (view === 'games') switchToGames()
       else if (view === 'recycle-bin') switchToRecycleBin()
       else setCurrentView(view)
     }}
   />
   ```
4. **移除侧边栏占位**：`<main>` 区域不再需要与侧边栏并排，移除外层 flex row 布局

   ```jsx
   // 修改前
   <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
     <Sidebar ... />
     <main style={styles.main} ref={gridRef}>...</main>
   </div>

   // 修改后
   <main style={{ ...styles.main, flex: 1, overflow: 'auto' }} ref={gridRef}>...</main>
   ```

***

### 步骤 4：清理 `Sidebar.jsx` 及相关引用

1. **删除** **`Sidebar.jsx`** 文件（或保留但不再使用）
2. **更新** **`components/index.js`**：移除 `Sidebar` 的导出
3. **清理** **`sharedStyles.js`**：移除 `sidebar`、`sidebarTitle`、`navItem`、`navItemActive`、`debugPanel`、`debugLine` 等不再使用的样式（注意：需检查是否有其他组件引用这些样式）

***

### 步骤 5：更新 `sharedStyles.js` 样式

**文件**：`src/styles/sharedStyles.js`（修改）

1. 移除 `sidebar`、`sidebarTitle`、`navItem`、`navItemActive`、`debugPanel`、`debugLine` 样式定义
2. 确保 `main` 样式适配全宽布局（移除侧边栏后的空间）

***

### 步骤 6：处理调试面板迁移

当前 `Sidebar` 中包含调试面板（`showDebug && logs`），移除侧边栏后需要为调试信息找到新的展示位置。

**方案**：将调试面板移至主内容区右下角，作为固定悬浮面板显示。

* 在 `App.jsx` 中，在 `<main>` 区域内添加条件渲染的调试面板

* 使用 `position: fixed`，`bottom: 16px`，`right: 16px`，`zIndex: 500`

* 保持原有样式风格（`theme.accent` 背景，小字号）

***

### 步骤 7：验证与测试

1. **功能验证**：

   * 四个导航项均可正常切换视图

   * 回收站徽章正确显示计数

   * 从系统托盘导航到设置页面仍正常工作

   * 游戏详情视图的返回导航不受影响

2. **交互验证**：

   * 悬浮触发延迟 ≤ 300ms

   * 鼠标移出 300ms 后菜单自动收起

   * 点击菜单项后菜单自动收起

   * 点击菜单外部区域菜单收起

   * 过渡动画平滑（0.2s 淡入淡出 + 位移）

3. **键盘访问验证**：

   * Tab 键可聚焦到导航按钮

   * Enter/Space 可开关菜单

   * Tab 在菜单项间导航

   * Escape 关闭菜单

4. **主题兼容性**：

   * 5 个主题下均显示正常

   * 颜色方案与各主题协调

5. **响应式验证**：

   * 窗口缩小时菜单不溢出

   * 最小窗口尺寸（400x300）下仍可正常使用

***

## 文件变更清单

| 文件                               | 操作 | 说明                                       |
| -------------------------------- | -- | ---------------------------------------- |
| `src/components/NavDropdown.jsx` | 新建 | 悬浮下拉菜单导航组件                               |
| `src/components/TitleBar.jsx`    | 修改 | 集成 NavDropdown，增加导航相关 props              |
| `src/App.jsx`                    | 修改 | 移除 Sidebar，更新 TitleBar props，调整布局，迁移调试面板 |
| `src/components/index.js`        | 修改 | 移除 Sidebar 导出，添加 NavDropdown 导出          |
| `src/components/Sidebar.jsx`     | 删除 | 不再需要的侧边栏组件                               |
| `src/styles/sharedStyles.js`     | 修改 | 移除侧边栏相关样式定义                              |

***

## 风险与注意事项

1. **向后兼容**：`sidebarCollapsed` 的 `localStorage` 键将不再使用，无需清理（不影响功能）
2. **调试面板**：需确保调试功能（F5 切换）在新位置仍正常工作
3. **Tauri 事件**：`navigate-to-settings` 事件监听不受影响，仍在 App.jsx 中
4. **主题适配**：下拉菜单使用 `theme.card` 作为背景色，需确认在各主题下对比度足够
5. **z-index 层级**：下拉菜单需高于标题栏（z-index: 100），建议设为 200

