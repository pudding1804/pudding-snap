# 导航系统重构：侧边栏 → 悬浮下拉菜单（已完成）

## 概述

将左侧固定侧边栏（`Sidebar.jsx`）替换为悬浮下拉菜单导航系统（`NavDropdown.jsx`）。NavDropdown 嵌入各视图页面头部标题位置，悬浮时展开包含四个导航选项的下拉菜单。

---

## 最终实现方案

### 布局结构变化

```
修改前:
<ErrorBoundary>
  <div (flex column)>
    <TitleBar />
    <div (flex row, flex: 1)>
      <Sidebar (48-200px) />     ← 左侧固定侧边栏
      <main (flex: 1) />
    </div>
  </div>
</ErrorBoundary>

修改后:
<ErrorBoundary>
  <div (flex column)>
    <TitleBar />                 ← 标题栏保持不变
    <main (flex: 1)>
      <NavDropdown />            ← 嵌入各视图头部标题位置
      ...视图内容...
    </main>
  </div>
</ErrorBoundary>
```

### NavDropdown 集成位置

NavDropdown 替换了各视图组件头部的 `<h1>` 标题文字，作为触发按钮：

| 视图组件 | 原标题 | 替换为 |
|----------|--------|--------|
| ScreenshotGrid.jsx | `<h1>按时间浏览</h1>` | `<NavDropdown />` |
| GameList.jsx | `<h1>按游戏浏览</h1>` | `<NavDropdown />` |
| RecycleBin.jsx | `<h1>回收站</h1>` | `<NavDropdown />` |
| SettingsPanel.jsx | `<h1>设置</h1>` | `<NavDropdown />` |
| GameDetail.jsx | 保持原有返回按钮+游戏名称布局 | 不变 |

### 组件接口

```jsx
export function NavDropdown({
  theme,              // 主题对象
  currentView,        // 当前视图名
  t,                  // 国际化翻译对象
  recycleBinCount = 0, // 回收站计数
  onNavigate          // 导航回调 (viewName) => void
})
```

### 交互特性

- **悬浮触发**：鼠标进入 200ms 后展开菜单（< 300ms）
- **自动收起**：鼠标离开 300ms 后自动收起
- **过渡动画**：0.2s 淡入淡出 + translateY 位移
- **悬停反馈**：菜单项 hover 时背景色变化 + translateX(2px)
- **选中标识**：当前视图项左侧 3px 高亮条 + 文字加粗变色
- **回收站徽章**：红色计数徽章
- **键盘访问**：Tab/Enter/Space/Escape/方向键
- **点击外部关闭**：点击菜单外部区域自动收起

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/NavDropdown.jsx` | 新建 | 悬浮下拉菜单导航组件 |
| `src/components/Pagination.jsx` | 重写 | 简约紧凑的5按钮分页组件 |
| `src/components/TitleBar.jsx` | 保持 | 标题栏不变，未集成 NavDropdown |
| `src/components/ScreenshotGrid.jsx` | 修改 | 标题替换为 NavDropdown，传入导航 props |
| `src/components/GameList.jsx` | 修改 | 标题替换为 NavDropdown，传入导航 props |
| `src/components/RecycleBin.jsx` | 修改 | 标题替换为 NavDropdown，传入导航 props |
| `src/components/SettingsPanel.jsx` | 修改 | 标题替换为 NavDropdown，传入导航 props |
| `src/App.jsx` | 修改 | 移除 Sidebar/sidebarCollapsed，为各视图传入导航 props，迁移调试面板 |
| `src/components/index.js` | 修改 | 替换 Sidebar 导出为 NavDropdown |
| `src/components/Sidebar.jsx` | 删除 | 不再需要的侧边栏组件 |
| `src/styles/sharedStyles.js` | 修改 | 移除 sidebar/navItem/navItemActive/debugPanel/debugLine 样式 |

---

## 附加修复

1. **回收站计数即时刷新**：软删除截图后立即调用 `refreshRecycleBinCount()`
2. **附注检索 Enter 确认**：ScreenshotGrid 附注输入框支持 Enter 键触发筛选
3. **分页组件简约化**：5按钮布局，点击页码可跳转，移除大背景卡片
4. **调试面板迁移**：从侧边栏底部迁移为右下角固定悬浮面板（`position: fixed`）
5. **主区域底部 padding**：移除 `main` 的 `paddingBottom`，分页条紧贴容器底部
