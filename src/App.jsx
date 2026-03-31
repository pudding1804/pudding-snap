import { useState, useEffect, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'

const themes = {
  night: {
    name: '夜晚',
    colors: {
      bg: '#1a1a2e',
      sidebar: '#16213e',
      card: '#16213e',
      accent: '#0f3460',
      text: '#eee',
      textMuted: '#888',
      primary: '#4ade80',
      danger: '#ef4444',
      border: '#0f3460',
    }
  },
  day: {
    name: '白天',
    colors: {
      bg: '#f5f5f5',
      sidebar: '#ffffff',
      card: '#ffffff',
      accent: '#e8e8e8',
      text: '#333',
      textMuted: '#666',
      primary: '#3b82f6',
      danger: '#ef4444',
      border: '#ddd',
    }
  },
  pink: {
    name: '浅粉',
    colors: {
      bg: '#fce4ec',
      sidebar: '#f8bbd9',
      card: '#ffffff',
      accent: '#f48fb1',
      text: '#4a4a4a',
      textMuted: '#7a7a7a',
      primary: '#ec407a',
      danger: '#e57373',
      border: '#f8bbd9',
    }
  },
  blue: {
    name: '浅蓝',
    colors: {
      bg: '#e3f2fd',
      sidebar: '#bbdefb',
      card: '#ffffff',
      accent: '#90caf9',
      text: '#37474f',
      textMuted: '#607d8b',
      primary: '#2196f3',
      danger: '#ef5350',
      border: '#bbdefb',
    }
  },
  green: {
    name: '浅绿',
    colors: {
      bg: '#e8f5e9',
      sidebar: '#c8e6c9',
      card: '#ffffff',
      accent: '#a5d6a7',
      text: '#2e7d32',
      textMuted: '#558b2f',
      primary: '#4caf50',
      danger: '#ef5350',
      border: '#c8e6c9',
    }
  }
}

function App() {
  const [currentView, setCurrentView] = useState('time')
  const [screenshots, setScreenshots] = useState([])
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(null)
  const [selectedScreenshotIndex, setSelectedScreenshotIndex] = useState(0)
  const [isModalClosing, setIsModalClosing] = useState(false)
  const [sortOrder, setSortOrder] = useState('desc')
  const [gameSortOrder, setGameSortOrder] = useState('time_desc')
  const [iconSize, setIconSize] = useState(() => {
    const saved = localStorage.getItem('iconSize')
    return saved || 'large'
  })
  const [isLoading, setIsLoading] = useState(true)
  const [notification, setNotification] = useState(null)
  const [error, setError] = useState(null)
  const [logs, setLogs] = useState(['应用启动...'])
  const [noteText, setNoteText] = useState('')
  const [currentTheme, setCurrentTheme] = useState('night')
  
  // 首次使用向导
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  
  // 分页相关状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  // 多选删除相关状态
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedScreenshots, setSelectedScreenshots] = useState([])
  
  // 文件夹相关状态
  const [storagePath, setStoragePath] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState(0)
  
  // 鼠标捕捉设置
  const [captureMouse, setCaptureMouse] = useState(false)
  
  // 开机自启动设置
  const [autostart, setAutostart] = useState(false)
  
  // 语言设置
  const [language, setLanguage] = useState('zh')
  
  // 检索信息弹窗状态
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchModalStep, setSearchModalStep] = useState('source') // 'source' | 'steam' | 'results'
  const [steamSearchTerm, setSteamSearchTerm] = useState('')
  const [steamSearchResults, setSteamSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isApplyingInfo, setIsApplyingInfo] = useState(false)
  const [showApplySuccess, setShowApplySuccess] = useState(false)
  const [appliedGameName, setAppliedGameName] = useState('')
  const [screenshotNotification, setScreenshotNotification] = useState(false)
  
  const showScreenshotNotification = () => {
    setScreenshotNotification(true)
    setTimeout(() => {
      setScreenshotNotification(false)
    }, 2000)
  }
  
  // 三点菜单状态
  const [showMenu, setShowMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  
  const toggleSidebar = () => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }
  
  const handleIconSizeChange = (size) => {
    setIconSize(size)
    localStorage.setItem('iconSize', size)
  }
  
  // 刷新防抖
  const refreshDebounceRef = useRef(null)
  const isRefreshingRef = useRef(false)

  const theme = themes[currentTheme].colors
  
  // 多语言支持
  const t = {
    'zh': {
      nav: {
        time: '按时间浏览',
        games: '按游戏浏览',
        settings: '设置'
      },
      header: {
        sort_newest: '从新到旧',
        sort_oldest: '从旧到新',
        multi_select: '多选删除',
        cancel_select: '取消选定',
        confirm_delete: '确定删除',
        game_sort_newest: '时间从新到旧',
        game_sort_oldest: '时间从旧到新',
        game_sort_alpha_asc: '按字母升序',
        game_sort_alpha_desc: '按字母降序',
        search_info: '检索信息',
        steam_found: 'Steam信息检索成功',
        steam_not_found: '未找到Steam信息',
        steam_mismatch: 'Steam信息不匹配',
        steam_searching: '正在检索Steam信息...',
        more_options: '更多选项',
        sort_by: '排序方式',
        note_hint: '附注 (最多120字)',
        note_shortcut: '按Ctrl+Enter保存',
        note_saved: '附注已保存',
        icon_large: '大图标',
        icon_small: '小图标'
      },
      search: {
        title: '检索游戏信息',
        select_source: '选择信息来源',
        coming_soon: '即将推出',
        placeholder: '输入游戏名称搜索...',
        search: '搜索',
        searching: '搜索中...',
        back: '返回',
        found_results: '找到 {count} 个结果',
        no_results: '未找到相关游戏',
        applying: '拉取信息中...',
        apply_success: '信息已拉取完成',
        confirm: '确认'
      },
      empty: {
        no_screenshots: '还没有截图',
        no_games: '还没有游戏记录',
        no_game_screenshots: '该游戏没有截图',
        screenshot_hint: '按 PrintScreen 或 F12 进行截图',
        game_hint: '截图后会自动识别游戏'
      },
      settings: {
        title: '设置',
        theme: '主题',
        storage: '存储位置',
        current_path: '当前存储位置:',
        change_path: '更改存储位置',
        migrating: '迁移中...',
        storage_hint: '数据库和截图在同一目录，可直接复制整个文件夹到其他电脑使用',
        hotkeys: '快捷键',
        hotkey_print: 'PrintScreen - 截图',
        hotkey_f12: 'F12 - 测试截图（调试模式）',
        system: '系统选项',
        autostart: '开机自启动',
        autostart_hint: '启用后，程序会在系统启动时自动运行',
        screenshot: '截图选项',
        capture_mouse: '捕捉鼠标光标',
        capture_mouse_hint: '启用后，截图时会包含鼠标光标',
        about: '关于',
        version: '极简游戏截图管理器 v0.1.0',
        tech: 'Rust + Tauri + React',
        language: '语言',
        delete_all: '删除所有数据',
        delete_all_hint: '此操作将删除所有截图、数据库和设置，无法恢复',
        delete_all_confirm: '确定要删除所有数据吗？此操作无法恢复！',
        restart_required: '需要重启程序',
        restart_now: '现在重启',
        languages: {
          zh: '中文',
          en: 'English',
          ja: '日本语'
        }
      },
      game: {
        last_updated: '最后更新于:',
        screenshots: '张截图'
      },
      detail: {
        note: '附注:',
        save_note: '保存附注',
        delete: '删除',
        open_folder: '打开文件夹',
        confirm_delete: '确定要删除这张截图吗？'
      },
      notifications: {
        save_success: '保存成功',
        note_saved: '附注已保存',
        delete_success: '删除成功',
        delete_failed: '删除失败',
        folder_opened: '打开文件夹',
        folder_failed: '打开文件夹失败',
        storage_changed: '存储位置已更改',
        storage_failed: '存储位置更改失败',
        migration_failed: '数据迁移失败',
        autostart_saved: '开机自启动设置已保存',
        autostart_failed: '保存开机自启动设置失败',
        mouse_capture_saved: '鼠标捕捉设置已保存',
        mouse_capture_failed: '保存鼠标捕捉设置失败'
      },
      logs: {
        app_start: '应用启动...',
        navigate_settings: '导航到设置',
        load_screenshots: '加载截图',
        load_more: '加载更多截图',
        load_games: '加载游戏列表',
        screenshot_taken: '截图成功',
        screenshot_failed: '截图失败',
        note_saved: '附注保存成功',
        note_failed: '附注保存失败',
        delete_succeeded: '截图删除成功',
        delete_failed: '截图删除失败',
        folder_opened: '打开文件夹',
        folder_failed: '打开文件夹失败',
        storage_changed: '存储位置已更改',
        storage_failed: '存储位置更改失败',
        migration_failed: '数据迁移失败',
        autostart_loaded: '获取开机自启动状态',
        autostart_saved: '开机自启动设置已保存',
        autostart_failed: '保存开机自启动设置失败',
        mouse_capture_loaded: '获取鼠标捕捉设置',
        mouse_capture_saved: '鼠标捕捉设置已保存',
        mouse_capture_failed: '保存鼠标捕捉设置失败'
      }
    },
    'en': {
      nav: {
        time: 'Browse by Time',
        games: 'Browse by Game',
        settings: 'Settings'
      },
      header: {
        sort_newest: 'Newest First',
        sort_oldest: 'Oldest First',
        multi_select: 'Multi-select Delete',
        cancel_select: 'Cancel Selection',
        confirm_delete: 'Confirm Delete',
        game_sort_newest: 'Newest First',
        game_sort_oldest: 'Oldest First',
        game_sort_alpha_asc: 'Alphabetical (A-Z)',
        game_sort_alpha_desc: 'Alphabetical (Z-A)',
        search_info: 'Search Info',
        steam_found: 'Steam info found',
        steam_not_found: 'Steam info not found',
        steam_mismatch: 'Steam info mismatch',
        steam_searching: 'Searching Steam info...',
        more_options: 'More Options',
        sort_by: 'Sort By',
        note_hint: 'Note (max 120 chars)',
        note_shortcut: 'Press Ctrl+Enter to save',
        note_saved: 'Note saved',
        icon_large: 'Large Icons',
        icon_small: 'Small Icons'
      },
      search: {
        title: 'Search Game Info',
        select_source: 'Select source',
        coming_soon: 'Coming Soon',
        placeholder: 'Enter game name to search...',
        search: 'Search',
        searching: 'Searching...',
        back: 'Back',
        found_results: 'Found {count} results',
        no_results: 'No games found',
        applying: 'Fetching info...',
        apply_success: 'Info fetched successfully',
        confirm: 'OK'
      },
      empty: {
        no_screenshots: 'No screenshots yet',
        no_games: 'No game records yet',
        no_game_screenshots: 'No screenshots for this game',
        screenshot_hint: 'Press PrintScreen or F12 to take a screenshot',
        game_hint: 'Games will be automatically detected after taking screenshots'
      },
      settings: {
        title: 'Settings',
        theme: 'Theme',
        storage: 'Storage Location',
        current_path: 'Current storage location:',
        change_path: 'Change Storage Location',
        migrating: 'Migrating...',
        storage_hint: 'Database and screenshots are in the same directory, you can directly copy the entire folder to another computer',
        hotkeys: 'Hotkeys',
        hotkey_print: 'PrintScreen - Take screenshot',
        hotkey_f12: 'F12 - Test screenshot (debug mode)',
        system: 'System Options',
        autostart: 'Start on boot',
        autostart_hint: 'When enabled, the program will automatically run when the system starts',
        screenshot: 'Screenshot Options',
        capture_mouse: 'Capture mouse cursor',
        capture_mouse_hint: 'When enabled, screenshots will include the mouse cursor',
        about: 'About',
        version: 'Minimal Game Screenshot Manager v0.1.0',
        tech: 'Rust + Tauri + React',
        language: 'Language',
        delete_all: 'Delete All Data',
        delete_all_hint: 'This operation will delete all screenshots, database and settings, cannot be recovered',
        delete_all_confirm: 'Are you sure you want to delete all data? This operation cannot be recovered!',
        restart_required: 'Restart required',
        restart_now: 'Restart Now',
        languages: {
          zh: '中文',
          en: 'English',
          ja: '日本语'
        }
      },
      game: {
        last_updated: 'Last updated:',
        screenshots: 'screenshots'
      },
      detail: {
        note: 'Note:',
        save_note: 'Save Note',
        delete: 'Delete',
        open_folder: 'Open Folder',
        confirm_delete: 'Are you sure you want to delete this screenshot?'
      },
      notifications: {
        save_success: 'Save Success',
        note_saved: 'Note saved',
        delete_success: 'Delete Success',
        delete_failed: 'Delete Failed',
        folder_opened: 'Folder Opened',
        folder_failed: 'Failed to open folder',
        storage_changed: 'Storage location changed',
        storage_failed: 'Failed to change storage location',
        migration_failed: 'Data migration failed',
        autostart_saved: 'Autostart setting saved',
        autostart_failed: 'Failed to save autostart setting',
        mouse_capture_saved: 'Mouse capture setting saved',
        mouse_capture_failed: 'Failed to save mouse capture setting'
      },
      logs: {
        app_start: 'App started...',
        navigate_settings: 'Navigate to settings',
        load_screenshots: 'Loading screenshots',
        load_more: 'Loading more screenshots',
        load_games: 'Loading games',
        screenshot_taken: 'Screenshot taken',
        screenshot_failed: 'Failed to take screenshot',
        note_saved: 'Note saved successfully',
        note_failed: 'Failed to save note',
        delete_succeeded: 'Screenshot deleted successfully',
        delete_failed: 'Failed to delete screenshot',
        folder_opened: 'Folder opened',
        folder_failed: 'Failed to open folder',
        storage_changed: 'Storage location changed',
        storage_failed: 'Failed to change storage location',
        migration_failed: 'Data migration failed',
        autostart_loaded: 'Getting autostart status',
        autostart_saved: 'Autostart setting saved',
        autostart_failed: 'Failed to save autostart setting',
        mouse_capture_loaded: 'Getting mouse capture setting',
        mouse_capture_saved: 'Mouse capture setting saved',
        mouse_capture_failed: 'Failed to save mouse capture setting'
      }
    },
    'ja': {
      nav: {
        time: '時間で参照',
        games: 'ゲームで参照',
        settings: '設定'
      },
      header: {
        sort_newest: '新しい順',
        sort_oldest: '古い順',
        multi_select: '複数選択削除',
        cancel_select: '選択をキャンセル',
        confirm_delete: '削除を確認',
        game_sort_newest: '新しい順',
        game_sort_oldest: '古い順',
        game_sort_alpha_asc: 'アルファベット順 (A-Z)',
        game_sort_alpha_desc: 'アルファベット順 (Z-A)',
        search_info: '情報検索',
        steam_found: 'Steam情報が見つかりました',
        steam_not_found: 'Steam情報が見つかりません',
        steam_mismatch: 'Steam情報が一致しません',
        steam_searching: 'Steam情報を検索中...',
        more_options: 'その他のオプション',
        sort_by: '並び替え',
        note_hint: 'メモ (最大120文字)',
        note_shortcut: 'Ctrl+Enterで保存',
        note_saved: 'メモを保存しました',
        icon_large: '大きなアイコン',
        icon_small: '小さなアイコン'
      },
      search: {
        title: 'ゲーム情報検索',
        select_source: '情報源を選択',
        coming_soon: '近日公開',
        placeholder: 'ゲーム名を入力して検索...',
        search: '検索',
        searching: '検索中...',
        back: '戻る',
        found_results: '{count}件の結果が見つかりました',
        no_results: '関連するゲームが見つかりません',
        applying: '情報を取得中...',
        apply_success: '情報の取得が完了しました',
        confirm: '確認'
      },
      empty: {
        no_screenshots: 'まだスクリーンショットはありません',
        no_games: 'まだゲームの記録はありません',
        no_game_screenshots: 'このゲームにはスクリーンショットがありません',
        screenshot_hint: 'PrintScreen または F12 を押してスクリーンショットを撮ります',
        game_hint: 'スクリーンショットを撮るとゲームが自動的に認識されます'
      },
      settings: {
        title: '設定',
        theme: 'テーマ',
        storage: 'ストレージの場所',
        current_path: '現在のストレージの場所:',
        change_path: 'ストレージの場所を変更',
        migrating: '移行中...',
        storage_hint: 'データベースとスクリーンショットは同じディレクトリにあります。フォルダ全体を別のコンピュータに直接コピーできます',
        hotkeys: 'ホットキー',
        hotkey_print: 'PrintScreen - スクリーンショットを撮る',
        hotkey_f12: 'F12 - テストスクリーンショット（デバッグモード）',
        system: 'システムオプション',
        autostart: '起動時に実行',
        autostart_hint: '有効にすると、システムの起動時にプログラムが自動的に実行されます',
        screenshot: 'スクリーンショットオプション',
        capture_mouse: 'マウスカーソルをキャプチャ',
        capture_mouse_hint: '有効にすると、スクリーンショットにマウスカーソルが含まれます',
        about: 'について',
        version: 'ミニマルゲームスクリーンショットマネージャー v0.1.0',
        tech: 'Rust + Tauri + React',
        language: '言語',
        delete_all: 'すべてのデータを削除',
        delete_all_hint: 'この操作により、すべてのスクリーンショット、データベース、設定が削除され、回復することはできません',
        delete_all_confirm: '本当にすべてのデータを削除しますか？この操作は元に戻すことができません！',
        restart_required: '再起動が必要',
        restart_now: '今すぐ再起動',
        languages: {
          zh: '中文',
          en: 'English',
          ja: '日本语'
        }
      },
      game: {
        last_updated: '最終更新:',
        screenshots: '枚のスクリーンショット'
      },
      detail: {
        note: 'メモ:',
        save_note: 'メモを保存',
        delete: '削除',
        open_folder: 'フォルダを開く',
        confirm_delete: 'このスクリーンショットを削除してもよろしいですか？'
      },
      notifications: {
        save_success: '保存成功',
        note_saved: 'メモを保存しました',
        delete_success: '削除成功',
        delete_failed: '削除に失敗しました',
        folder_opened: 'フォルダを開きました',
        folder_failed: 'フォルダを開くことができませんでした',
        storage_changed: 'ストレージの場所を変更しました',
        storage_failed: 'ストレージの場所の変更に失敗しました',
        migration_failed: 'データ移行に失敗しました',
        autostart_saved: '起動時実行の設定を保存しました',
        autostart_failed: '起動時実行の設定の保存に失敗しました',
        mouse_capture_saved: 'マウスキャプチャの設定を保存しました',
        mouse_capture_failed: 'マウスキャプチャの設定の保存に失敗しました'
      },
      logs: {
        app_start: 'アプリ起動...',
        navigate_settings: '設定に移動',
        load_screenshots: 'スクリーンショットを読み込み中',
        load_more: 'スクリーンショットをさらに読み込み中',
        load_games: 'ゲームを読み込み中',
        screenshot_taken: 'スクリーンショットを撮りました',
        screenshot_failed: 'スクリーンショットの撮影に失敗しました',
        note_saved: 'メモを保存しました',
        note_failed: 'メモの保存に失敗しました',
        delete_succeeded: 'スクリーンショットを削除しました',
        delete_failed: 'スクリーンショットの削除に失敗しました',
        folder_opened: 'フォルダを開きました',
        folder_failed: 'フォルダを開くことができませんでした',
        storage_changed: 'ストレージの場所を変更しました',
        storage_failed: 'ストレージの場所の変更に失敗しました',
        migration_failed: 'データ移行に失敗しました',
        autostart_loaded: '起動時実行の状態を取得中',
        autostart_saved: '起動時実行の設定を保存しました',
        autostart_failed: '起動時実行の設定の保存に失敗しました',
        mouse_capture_loaded: 'マウスキャプチャの設定を取得中',
        mouse_capture_saved: 'マウスキャプチャの設定を保存しました',
        mouse_capture_failed: 'マウスキャプチャの設定の保存に失敗しました'
      }
    }
  }[language]
  const gridRef = useRef(null)

  const addLog = (msg) => {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}] ${msg}`)
    setLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`])
  }

  const loadGames = async (sortType = null) => {
    try {
      addLog('调用 get_games')
      const gData = await invoke('get_games')
      addLog(`游戏数据: ${gData ? gData.length : 0} 条`)
      
      let sortedGames = gData || []
      const currentSort = sortType || gameSortOrder
      
      if (currentSort === 'alpha_asc') {
        sortedGames.sort((a, b) => (a.display_title || a.game_title).localeCompare(b.display_title || b.game_title, 'zh-CN'))
      } else if (currentSort === 'alpha_desc') {
        sortedGames.sort((a, b) => (b.display_title || b.game_title).localeCompare(a.display_title || a.game_title, 'zh-CN'))
      } else if (currentSort === 'time_asc') {
        sortedGames.sort((a, b) => (a.last_timestamp || 0) - (b.last_timestamp || 0))
      } else {
        sortedGames.sort((a, b) => (b.last_timestamp || 0) - (a.last_timestamp || 0))
      }
      
      setGames(sortedGames)
    } catch (e) {
      addLog(`游戏加载失败: ${e}`)
    }
  }

  const loadStoragePath = async () => {
    try {
      const path = await invoke('get_storage_path')
      setStoragePath(path || '程序目录/screenshot-data/')
    } catch (e) {
      addLog(`获取存储路径失败: ${e}`)
    }
  }

  const loadCaptureMouse = async () => {
    try {
      const enabled = await invoke('get_capture_mouse')
      setCaptureMouse(enabled)
    } catch (e) {
      addLog(`获取鼠标捕捉设置失败: ${e}`)
    }
  }

  const saveCaptureMouse = async (enabled) => {
    try {
      await invoke('set_capture_mouse', { enabled })
      setCaptureMouse(enabled)
      addLog(`鼠标捕捉设置已保存: ${enabled}`)
    } catch (e) {
      addLog(`保存鼠标捕捉设置失败: ${e}`)
    }
  }

  const loadAutostart = async () => {
    try {
      const { isEnabled } = await import('@tauri-apps/plugin-autostart')
      const enabled = await isEnabled()
      setAutostart(enabled)
      addLog(`开机自启动状态: ${enabled}`)
    } catch (e) {
      addLog(`获取开机自启动设置失败: ${e}`)
    }
  }

  const saveAutostart = async (enabled) => {
    try {
      const { enable, disable } = await import('@tauri-apps/plugin-autostart')
      if (enabled) {
        await enable()
      } else {
        await disable()
      }
      setAutostart(enabled)
      addLog(`开机自启动设置已保存: ${enabled}`)
    } catch (e) {
      addLog(`保存开机自启动设置失败: ${e}`)
    }
  }

  useEffect(() => {
    addLog('useEffect 初始化')
    
    const loadData = async () => {
      addLog('开始加载数据')
      try {
        await loadStoragePath()
        await loadCaptureMouse()
        await loadAutostart()
        await loadScreenshotsWithPagination(1, null)
      } catch (e) {
        addLog(`数据加载失败: ${e}`)
        setError('加载数据失败: ' + String(e))
      }
      
      await loadGames()
      
      setIsLoading(false)
      addLog('数据加载完成')
      
      const hideGuide = localStorage.getItem('hideGuide')
      if (!hideGuide) {
        try {
          await invoke('show_main_window')
          addLog('主窗口已显示（向导）')
        } catch (e) {
          addLog(`显示主窗口失败: ${e}`)
        }
        setShowGuide(true)
      } else {
        addLog('启动后自动最小化到系统托盘')
      }
    }
    
    loadData()

    const unlisten = listen('screenshot-taken', () => {
      addLog('收到截图事件，准备刷新')
      showScreenshotNotification()
      
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
      }
      
      refreshDebounceRef.current = setTimeout(async () => {
        if (isRefreshingRef.current) {
          addLog('刷新进行中，跳过')
          return
        }
        
        isRefreshingRef.current = true
        addLog('开始刷新数据')
        
        try {
          await loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
          await loadGames()
          addLog('数据刷新完成')
        } catch (e) {
          addLog(`刷新失败: ${e}`)
        } finally {
          isRefreshingRef.current = false
        }
      }, 300)
    })

    const unlistenTray = listen('tray-click', async () => {
      addLog('托盘点击事件')
      try {
        await invoke('show_window')
      } catch (e) {
        addLog(`显示窗口失败: ${e}`)
      }
    })

    const unlistenNotify = listen('show-notification', (event) => {
      const { title, body } = event.payload
      addLog(`通知: ${title} - ${body}`)
      setNotification({ title, body })
      setTimeout(() => setNotification(null), 3000)
    })

    const unlistenSettings = listen('navigate-to-settings', () => {
      addLog('导航到设置')
      setCurrentView('settings')
    })

    return () => {
      unlisten.then(f => f())
      unlistenTray.then(f => f())
      unlistenNotify.then(f => f())
      unlistenSettings.then(f => f())
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!selectedScreenshot) return
    
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        navigateScreenshot('prev')
      } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        navigateScreenshot('next')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedScreenshot, selectedScreenshotIndex])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        addLog('窗口变为可见，检查是否需要刷新')
        
        if (refreshDebounceRef.current) {
          clearTimeout(refreshDebounceRef.current)
        }
        
        refreshDebounceRef.current = setTimeout(async () => {
          if (isRefreshingRef.current) return
          
          isRefreshingRef.current = true
          
          try {
            await loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
            await loadGames()
          } catch (e) {
            addLog(`可见性刷新失败: ${e}`)
          } finally {
            isRefreshingRef.current = false
          }
        }, 200)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selectedGame?.game_id])

  const loadScreenshotsWithPagination = async (page, gameId = null, order = null) => {
    setIsLoading(true)
    const currentOrder = order || sortOrder
    try {
      addLog(`调用 get_screenshots_with_pagination, 页码: ${page}, 游戏ID: ${gameId || 'null'}, 排序: ${currentOrder}`)
      const data = await invoke('get_screenshots_with_pagination', {
        gameId,
        sortOrder: currentOrder,
        page,
        pageSize
      })
      addLog(`截图数据: ${data.screenshots ? data.screenshots.length : 0} 条, 总页数: ${data.total_pages}`)
      setScreenshots(data.screenshots || [])
      setCurrentPage(page)
      setTotalPages(data.total_pages || 1)
    } catch (e) {
      addLog(`截图加载失败: ${e}`)
      setError('加载截图失败: ' + String(e))
    }
    setIsLoading(false)
  }

  const loadMoreScreenshots = async () => {
    if (isLoadingMore || currentPage >= totalPages) return
    
    setIsLoadingMore(true)
    try {
      addLog(`加载更多截图，页码: ${currentPage + 1}`)
      const data = await invoke('get_screenshots_with_pagination', {
        gameId: selectedGame?.game_id || null,
        sortOrder,
        page: currentPage + 1,
        pageSize
      })
      setScreenshots(prev => [...prev, ...(data.screenshots || [])])
      setCurrentPage(currentPage + 1)
    } catch (e) {
      addLog(`加载更多截图失败: ${e}`)
    }
    setIsLoadingMore(false)
  }

  const handleSortChange = async (newOrder) => {
    setSortOrder(newOrder)
    await loadScreenshotsWithPagination(1, null, newOrder)
  }

  const handleGameSortChange = async (newOrder) => {
    setGameSortOrder(newOrder)
    if (selectedGame) {
      const order = newOrder === 'alpha_asc' || newOrder === 'alpha_desc' ? 'desc' : (newOrder === 'time_asc' ? 'asc' : 'desc')
      await loadScreenshotsWithPagination(1, selectedGame.game_id, order)
    } else {
      await loadGames(newOrder)
    }
  }

  const selectGame = async (game) => {
    setSelectedGame(game)
    setCurrentView('game-detail')
    const order = gameSortOrder === 'time_asc' ? 'asc' : 'desc'
    await loadScreenshotsWithPagination(1, game.game_id, order)
  }

  const backToGames = async () => {
    setSelectedGame(null)
    setCurrentView('games')
    await loadGames()
    await loadScreenshotsWithPagination(1, null)
  }

  const switchToGames = async () => {
    setCurrentView('games')
    setSelectedGame(null)
    await loadGames()
  }

  const switchToTimeView = async () => {
    setCurrentView('time')
    setSelectedGame(null)
    await loadScreenshotsWithPagination(1, null)
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN')
  }

  const closeModal = () => {
    setIsModalClosing(true)
    setTimeout(() => {
      setSelectedScreenshot(null)
      setIsModalClosing(false)
    }, 250)
  }

  const navigateScreenshot = (direction) => {
    if (!selectedScreenshot) return
    
    const currentIndex = selectedScreenshotIndex
    let newIndex = currentIndex
    
    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1
    } else if (direction === 'next' && currentIndex < screenshots.length - 1) {
      newIndex = currentIndex + 1
    }
    
    if (newIndex !== currentIndex) {
      const newScreenshot = screenshots[newIndex]
      setSelectedScreenshot(newScreenshot)
      setSelectedScreenshotIndex(newIndex)
      setNoteText(newScreenshot.note || '')
    }
  }

  const saveNote = async (id, note) => {
    try {
      await invoke('update_note', { id, note })
      addLog(`附注保存成功: ID=${id}`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      closeModal()
      setNotification({ title: t.header.note_saved, body: '' })
      setTimeout(() => setNotification(null), 2000)
    } catch (e) {
      addLog(`附注保存失败: ${e}`)
      setError('保存附注失败: ' + String(e))
    }
  }

  const deleteScreenshot = async (id) => {
    if (!confirm('确定要删除这张截图吗？')) return
    try {
      await invoke('delete_screenshot', { id })
      addLog(`截图删除成功: ID=${id}`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      closeModal()
      
      if (selectedGame && screenshots.length <= 1) {
        setSelectedGame(null)
        await loadGames()
      }
    } catch (e) {
      addLog(`截图删除失败: ${e}`)
      setError('删除截图失败: ' + String(e))
    }
  }

  const openInExplorer = async (filePath) => {
    try {
      await invoke('open_in_explorer', { filePath })
      addLog(`打开文件夹: ${filePath}`)
    } catch (e) {
      addLog(`打开文件夹失败: ${e}`)
      setError('打开文件夹失败: ' + String(e))
    }
  }

  const deleteSelectedScreenshots = async () => {
    if (selectedScreenshots.length === 0) return
    
    if (!confirm(`确定要删除 ${selectedScreenshots.length} 张截图吗？`)) return
    
    const deleteCount = selectedScreenshots.length
    
    try {
      await invoke('delete_screenshots', { ids: selectedScreenshots })
      addLog(`批量删除成功: ${deleteCount} 张`)
      await loadScreenshotsWithPagination(currentPage, selectedGame?.game_id || null)
      setIsMultiSelectMode(false)
      setSelectedScreenshots([])
      setNotification({ title: '删除成功', body: `已删除 ${deleteCount} 张截图` })
      setTimeout(() => setNotification(null), 2000)
      
      if (selectedGame && screenshots.length <= deleteCount) {
        setSelectedGame(null)
        await loadGames()
      }
    } catch (e) {
      addLog(`批量删除失败: ${e}`)
      setError('批量删除失败: ' + String(e))
    }
  }

  const toggleSelectScreenshot = (id) => {
    setSelectedScreenshots(prev => {
      if (prev.includes(id)) {
        return prev.filter(sid => sid !== id)
      } else {
        return [...prev, id]
      }
    })
  }

  const changeStoragePath = async () => {
    try {
      // 使用简单的 prompt 暂时替代 dialog
      const newPath = prompt('请输入新的存储目录路径:');
      
      if (newPath) {
        setIsMigrating(true)
        setMigrationProgress(0)
        
        addLog(`开始迁移数据到: ${newPath}`)
        const result = await invoke('migrate_data', { newPath })
        
        if (result.success) {
          setStoragePath(newPath)
          setNotification({ title: '迁移成功', body: '数据已成功迁移到新目录' })
          await loadScreenshotsWithPagination(1, selectedGame?.game_id || null)
          await loadGames()
        } else {
          setError('迁移失败: ' + (result.error || '未知错误'))
        }
      }
    } catch (e) {
      addLog(`更改存储路径失败: ${e}`)
      setError('更改存储路径失败: ' + String(e))
    } finally {
      setIsMigrating(false)
      setMigrationProgress(0)
    }
  }

  const getImageSrc = (filePath) => {
    try {
      return convertFileSrc(filePath)
    } catch (e) {
      addLog(`图片路径转换失败: ${e}`)
      return ''
    }
  }

  const handleScroll = () => {
    if (!gridRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = gridRef.current
    const threshold = 100
    
    if (scrollHeight - scrollTop - clientHeight < threshold && !isLoadingMore && currentPage < totalPages) {
      loadMoreScreenshots()
    }
  }

  const cardWidth = iconSize === 'large' ? 280 : 187
  const cardGap = iconSize === 'large' ? 16 : 12

  const styles = {
    container: { display: 'flex', height: '100vh', background: theme.bg, color: theme.text, fontFamily: 'system-ui, sans-serif' },
    sidebar: { width: 200, background: theme.sidebar, padding: 16, display: 'flex', flexDirection: 'column' },
    sidebarTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 24, color: theme.primary },
    navItem: { padding: '12px 16px', cursor: 'pointer', borderRadius: 8, marginBottom: 4, transition: 'background 0.2s' },
    navItemActive: { background: theme.accent },
    main: { flex: 1, padding: 24, overflow: 'auto' },
    header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    title: { fontSize: 24, fontWeight: 'bold' },
    btn: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.text, cursor: 'pointer', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnPrimary: { padding: '8px 16px', background: theme.primary, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnDanger: { padding: '8px 16px', background: theme.danger, border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', transition: 'transform 0.15s, background 0.15s, opacity 0.15s' },
    btnDisabled: { padding: '8px 16px', background: theme.accent, border: 'none', borderRadius: 6, color: theme.textMuted, cursor: 'not-allowed', opacity: 0.6, transition: 'transform 0.15s' },
    grid: { display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${cardWidth}px)`, gap: cardGap, justifyContent: 'flex-start' },
    card: { background: theme.card, borderRadius: 8, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', width: cardWidth },
    cardImage: { width: '100%', aspectRatio: '16 / 9', objectFit: 'contain', background: theme.accent },
    cardInfo: { padding: 12 },
    cardTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    cardDate: { fontSize: 12, color: theme.textMuted },
    gameCard: { background: theme.card, borderRadius: 8, padding: 16, cursor: 'pointer', textAlign: 'center', transition: 'transform 0.2s', width: cardWidth },
    gameIcon: { width: '100%', height: iconSize === 'large' ? 116 : 77, borderRadius: 8, background: theme.accent, margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: iconSize === 'large' ? 32 : 24, overflow: 'hidden' },
    gameIconImage: { width: '100%', height: '100%', objectFit: 'cover' },
    gameLogoImage: { width: '100%', height: '100%', objectFit: 'cover' },
    gameTitle: { fontWeight: 'bold', marginBottom: 4 },
    gameCount: { fontSize: 12, color: theme.textMuted },
    modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
    modalContent: { background: theme.card, borderRadius: 12, maxWidth: '90vw', maxHeight: '90vh', overflow: 'auto' },
    modalHeader: { padding: 16, borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    modalTitle: { fontSize: 18, fontWeight: 'bold' },
    closeBtn: { background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: theme.textMuted, padding: 0, lineHeight: 1, transition: 'transform 0.15s, color 0.15s' },
    modalBody: { padding: 16 },
    modalFooter: { padding: 16, borderTop: `1px solid ${theme.border}` },
    input: { width: '100%', padding: 8, background: theme.accent, border: `1px solid ${theme.border}`, borderRadius: 4, color: theme.text, boxSizing: 'border-box' },
    notification: { position: 'fixed', top: 16, right: 16, background: theme.primary, color: '#fff', padding: '12px 24px', borderRadius: 8, zIndex: 2000, fontWeight: 'bold' },
    debugPanel: { marginTop: 'auto', padding: 8, background: theme.accent, borderRadius: 4, fontSize: 10, maxHeight: 100, overflow: 'auto' },
    debugLine: { color: theme.primary, marginBottom: 2 },
    empty: { textAlign: 'center', padding: 48, color: theme.textMuted },
    loading: { textAlign: 'center', padding: 48, color: theme.primary },
    themeBtn: { padding: '10px 16px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold', transition: 'transform 0.15s, box-shadow 0.15s' },
    themeBtnActive: { transform: 'scale(1.05)', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
    pagination: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24, padding: 16, background: theme.card, borderRadius: 8 },
    paginationBtn: { padding: '6px 12px', background: theme.accent, border: 'none', borderRadius: 4, color: theme.text, cursor: 'pointer', transition: 'transform 0.15s, opacity 0.15s' },
    paginationBtnActive: { background: theme.primary, color: '#fff' },
    paginationInfo: { fontSize: 14, color: theme.textMuted },
    selectCheckbox: { position: 'absolute', top: 8, right: 8, width: 16, height: 16, border: `2px solid ${theme.border}`, borderRadius: 3, background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    selectCheckboxChecked: { background: theme.primary, borderColor: theme.primary },
    selectCheckboxInner: { width: 8, height: 8, background: '#fff' },
    cardWithCheckbox: { position: 'relative' },
    cardSelected: { transform: 'scale(0.98)', boxShadow: `0 0 0 2px ${theme.primary}` },
    migrationProgress: { width: '100%', height: 8, background: theme.accent, borderRadius: 4, overflow: 'hidden', marginTop: 12 },
    migrationProgressBar: { height: '100%', background: theme.primary, transition: 'width 0.3s ease' },
  }

  const btnEvents = {
    onMouseEnter: e => {
      e.currentTarget.style.transform = 'scale(1.05)'
      e.currentTarget.style.opacity = '0.9'
    },
    onMouseLeave: e => {
      e.currentTarget.style.transform = 'scale(1)'
      e.currentTarget.style.opacity = '1'
    },
    onMouseDown: e => {
      e.currentTarget.style.transform = 'scale(0.95)'
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'scale(1.05)'
    }
  }

  const modalExpandKeyframes = `
    @keyframes modalFadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes modalFadeOut {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes slideInLeft {
      0% { opacity: 0; transform: translateX(-30px); }
      100% { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeIn {
      0% { opacity: 0; }
      100% { opacity: 1; }
    }
    @keyframes fadeOut {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes slideInRight {
      0% { opacity: 0; transform: translateX(100%); }
      100% { opacity: 1; transform: translateX(0); }
    }
    @keyframes slideOutRight {
      0% { opacity: 1; transform: translateX(0); }
      100% { opacity: 0; transform: translateX(100%); }
    }
  `

  return (
    <>
      <style>{modalExpandKeyframes}</style>
      
      <div style={styles.container}>
      <nav style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? 48 : 200,
        padding: sidebarCollapsed ? 8 : 16,
        transition: 'width 0.25s ease, padding 0.25s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          ...styles.sidebarTitle, 
          opacity: sidebarCollapsed ? 0 : 1,
          transition: 'opacity 0.2s ease',
          whiteSpace: 'nowrap'
        }}>截图管理器</div>
        
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'time' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={switchToTimeView}
        >
          {t.nav.time}
        </div>
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'games' || currentView === 'game-detail' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={switchToGames}
        >
          {t.nav.games}
        </div>
        <div 
          style={{ 
            ...styles.navItem, 
            ...(currentView === 'settings' ? styles.navItemActive : {}),
            opacity: sidebarCollapsed ? 0 : 1,
            transition: 'opacity 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onClick={() => setCurrentView('settings')}
        >
          {t.nav.settings}
        </div>

        <div style={{ 
          ...styles.debugPanel,
          opacity: sidebarCollapsed ? 0 : 1,
          transition: 'opacity 0.2s ease'
        }}>
          {logs.slice(-5).map((log, i) => (
            <div key={i} style={styles.debugLine}>{log}</div>
          ))}
        </div>
        
        <button
          onClick={toggleSidebar}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 32,
            height: 32,
            background: theme.accent,
            border: 'none',
            borderRadius: 6,
            color: theme.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.15s ease, background 0.15s ease',
            zIndex: 10
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)'
            e.currentTarget.style.background = theme.card
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.background = theme.accent
          }}
          onMouseDown={e => {
            e.currentTarget.style.transform = 'scale(0.95)'
          }}
          onMouseUp={e => {
            e.currentTarget.style.transform = 'scale(1.1)'
          }}
          title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
        >
          <svg 
            width="16" 
            height="16" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            style={{ 
              transform: sidebarCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.25s ease'
            }}
          >
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      </nav>

      <main style={styles.main} ref={gridRef} onScroll={handleScroll}>
        {notification && (
          <div style={styles.notification}>
            {notification.title}: {notification.body}
          </div>
        )}

        {isLoading ? (
          <div style={styles.loading}>加载中...</div>
        ) : currentView === 'time' ? (
          <div>
            <div style={styles.header}>
              <h1 style={styles.title}>{t.nav.time}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isMultiSelectMode ? (
                  <>
                    <button style={styles.btn} {...btnEvents} onClick={() => {
                      setIsMultiSelectMode(false)
                      setSelectedScreenshots([])
                    }}>
                      {t.header.cancel_select}
                    </button>
                    <button 
                      style={selectedScreenshots.length > 0 ? styles.btnDanger : styles.btnDisabled}
                      {...(selectedScreenshots.length > 0 ? btnEvents : {})}
                      onClick={deleteSelectedScreenshots}
                      disabled={selectedScreenshots.length === 0}
                    >
                      {t.header.confirm_delete} ({selectedScreenshots.length})
                    </button>
                  </>
                ) : (
                  <>
                    <select 
                      value={sortOrder}
                      onChange={(e) => handleSortChange(e.target.value)}
                      style={{ 
                        padding: '8px 12px', 
                        background: theme.accent, 
                        border: 'none', 
                        borderRadius: 6, 
                        color: theme.text, 
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      <option value="desc">{t.header.sort_newest}</option>
                      <option value="asc">{t.header.sort_oldest}</option>
                    </select>
                    <select 
                      value={iconSize}
                      onChange={(e) => handleIconSizeChange(e.target.value)}
                      style={{ 
                        padding: '8px 12px', 
                        background: theme.accent, 
                        border: 'none', 
                        borderRadius: 6, 
                        color: theme.text, 
                        cursor: 'pointer',
                        fontSize: 14
                      }}
                    >
                      <option value="large">{t.header.icon_large}</option>
                      <option value="small">{t.header.icon_small}</option>
                    </select>
                    <button style={styles.btn} {...btnEvents} onClick={() => setIsMultiSelectMode(true)}>
                      {t.header.multi_select}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {screenshots.length === 0 ? (
              <div style={styles.empty}>
                <p>{t.empty.no_screenshots}</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>{t.empty.screenshot_hint}</p>
              </div>
            ) : (
              <>
                <div style={styles.grid}>
                  {screenshots.map((ss, index) => (
                    <div 
                      key={ss.id} 
                      style={{ 
                        ...styles.card, 
                        ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                        ...(isMultiSelectMode && selectedScreenshots.includes(ss.id) ? styles.cardSelected : {})
                      }}
                      onClick={(e) => {
                        if (isMultiSelectMode) {
                          toggleSelectScreenshot(ss.id)
                        } else {
                          setSelectedScreenshot(ss)
                          setSelectedScreenshotIndex(index)
                          setNoteText(ss.note || '')
                        }
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.03)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                      onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.98)'
                      }}
                      onMouseUp={e => {
                        e.currentTarget.style.transform = 'scale(1.03)'
                      }}
                    >
                      {isMultiSelectMode && (
                        <div style={{
                          ...styles.selectCheckbox,
                          ...(selectedScreenshots.includes(ss.id) ? styles.selectCheckboxChecked : {})
                        }}>
                          {selectedScreenshots.includes(ss.id) && (
                            <div style={styles.selectCheckboxInner} />
                          )}
                        </div>
                      )}
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16 / 9', 
                        background: theme.accent, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        <img 
                          src={getImageSrc(ss.thumbnail_path)} 
                          alt="截图缩略图" 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            objectPosition: 'center center'
                          }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                          loading="lazy"
                        />
                      </div>
                      <div style={styles.cardInfo}>
                        <div style={styles.cardTitle}>{ss.display_title || ss.game_title}</div>
                        <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                        {ss.note && <div style={{ fontSize: 11, color: theme.text, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{ss.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {isLoadingMore && (
                  <div style={styles.loading}>加载更多...</div>
                )}
                
                <div style={styles.pagination}>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(1, null)}
                    disabled={currentPage === 1}
                  >
                    首页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(Math.max(1, currentPage - 1), null)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span style={styles.paginationInfo}>
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(Math.min(totalPages, currentPage + 1), null)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(totalPages, null)}
                    disabled={currentPage === totalPages}
                  >
                    末页
                  </button>
                </div>
              </>
            )}
          </div>
        ) : currentView === 'games' ? (
          <div>
            <div style={styles.header}>
              <h1 style={styles.title}>{t.nav.games}</h1>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select 
                  value={gameSortOrder}
                  onChange={(e) => handleGameSortChange(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    background: theme.accent, 
                    border: 'none', 
                    borderRadius: 6, 
                    color: theme.text, 
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  <option value="time_desc">{t.header.game_sort_newest}</option>
                  <option value="time_asc">{t.header.game_sort_oldest}</option>
                  <option value="alpha_asc">{t.header.game_sort_alpha_asc}</option>
                  <option value="alpha_desc">{t.header.game_sort_alpha_desc}</option>
                </select>
                <select 
                  value={iconSize}
                  onChange={(e) => handleIconSizeChange(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    background: theme.accent, 
                    border: 'none', 
                    borderRadius: 6, 
                    color: theme.text, 
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  <option value="large">{t.header.icon_large}</option>
                  <option value="small">{t.header.icon_small}</option>
                </select>
              </div>
            </div>
            
            {games.length === 0 ? (
              <div style={styles.empty}>
                <p>{t.empty.no_games}</p>
                <p style={{ fontSize: 12, marginTop: 8 }}>{t.empty.game_hint}</p>
              </div>
            ) : (
              <div style={styles.grid}>
                {games.map((game, index) => {
                  const hasSteamLogo = !!game.steam_logo_path;
                  const iconSrc = game.steam_logo_path || game.game_icon_path;
                  return (
                  <div 
                    key={game.game_id} 
                    style={styles.gameCard}
                    onClick={() => selectGame(game)}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = 'scale(1.03)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = 'scale(1)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    onMouseDown={e => {
                      e.currentTarget.style.transform = 'scale(0.98)'
                    }}
                    onMouseUp={e => {
                      e.currentTarget.style.transform = 'scale(1.03)'
                    }}
                  >
                    <div style={styles.gameIcon}>
                      {iconSrc ? (
                        hasSteamLogo ? (
                          <img 
                            src={getImageSrc(iconSrc)} 
                            alt={`${game.display_title || game.game_title} 图标`}
                            style={styles.gameLogoImage}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentElement.innerHTML = game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?';
                            }}
                          />
                        ) : (
                          <div style={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: 8, 
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <img 
                              src={getImageSrc(iconSrc)} 
                              alt={`${game.display_title || game.game_title} 图标`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.parentElement.innerHTML = game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?';
                              }}
                            />
                          </div>
                        )
                      ) : (
                        game.display_title?.charAt(0) || game.game_title?.charAt(0) || '?'
                      )}
                    </div>
                    <div style={styles.gameTitle}>{game.display_title || game.game_title}</div>
                    <div style={styles.gameCount}>{game.count} {t.game.screenshots}</div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>
                      {t.game.last_updated} {formatDate(game.last_timestamp)}
                    </div>
                  </div>
                );})}
              </div>
            )}
          </div>
        ) : currentView === 'game-detail' ? (
          <div>
            <div style={{ ...styles.header, position: 'relative' }}>
              <button 
                style={{ ...styles.btn, padding: '8px 12px' }} 
                {...btnEvents}
                onClick={backToGames}
                title="返回游戏列表"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
              </button>
              <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 40, 
                  height: 40, 
                  borderRadius: 6, 
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {selectedGame?.game_icon_path ? (
                    <img 
                      src={getImageSrc(selectedGame.game_icon_path)} 
                      alt={`${selectedGame.display_title || selectedGame.game_title} 图标`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : selectedGame?.steam_logo_path ? (
                    <img 
                      src={getImageSrc(selectedGame.steam_logo_path)} 
                      alt={`${selectedGame.display_title || selectedGame.game_title} 图标`}
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : null}
                </div>
                <h1 style={styles.title}>{selectedGame?.display_title || selectedGame?.game_title}</h1>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
                {isMultiSelectMode ? (
                  <>
                    <button style={styles.btn} {...btnEvents} onClick={() => {
                      setIsMultiSelectMode(false)
                      setSelectedScreenshots([])
                    }}>
                      {t.header.cancel_select}
                    </button>
                    <button 
                      style={selectedScreenshots.length > 0 ? styles.btnDanger : styles.btnDisabled}
                      {...(selectedScreenshots.length > 0 ? btnEvents : {})}
                      onClick={deleteSelectedScreenshots}
                      disabled={selectedScreenshots.length === 0}
                    >
                      {t.header.confirm_delete} ({selectedScreenshots.length})
                    </button>
                  </>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <button 
                      style={{ 
                        ...styles.btn, 
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }} 
                      {...btnEvents}
                      onClick={() => setShowMenu(!showMenu)}
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="2"/>
                        <circle cx="12" cy="12" r="2"/>
                        <circle cx="12" cy="19" r="2"/>
                      </svg>
                    </button>
                    
                    {showMenu && (
                      <>
                        <div 
                          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }}
                          onClick={() => setShowMenu(false)}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          right: 0,
                          marginTop: 4,
                          background: theme.card,
                          borderRadius: 8,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                          minWidth: 160,
                          zIndex: 999,
                          overflow: 'hidden'
                        }}>
                          <div
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              transition: 'background 0.2s'
                            }}
                            onClick={() => {
                              setShowSearchModal(true)
                              setSearchModalStep('source')
                              setSteamSearchTerm('')
                              setSteamSearchResults([])
                              setShowMenu(false)
                            }}
                            onMouseEnter={e => e.target.style.background = theme.accent}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="11" cy="11" r="8"/>
                              <path d="M21 21l-4.35-4.35"/>
                            </svg>
                            {t.header.search_info}
                          </div>
                          
                          <div
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              transition: 'background 0.2s'
                            }}
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            onMouseEnter={e => e.target.style.background = theme.accent}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M6 12h12M9 18h6"/>
                              </svg>
                              {t.header.sort_by}
                            </div>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showSortMenu ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                              <path d="M9 18l6-6-6-6"/>
                            </svg>
                          </div>
                          
                          {showSortMenu && (
                            <div style={{ background: theme.accent }}>
                              {[
                                { value: 'time_desc', label: t.header.game_sort_newest },
                                { value: 'time_asc', label: t.header.game_sort_oldest }
                              ].map(option => (
                                <div
                                  key={option.value}
                                  style={{
                                    padding: '8px 16px 8px 32px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    background: gameSortOrder === option.value ? theme.primary : 'transparent',
                                    color: gameSortOrder === option.value ? '#fff' : theme.text,
                                    transition: 'background 0.2s'
                                  }}
                                  onClick={() => {
                                    handleGameSortChange(option.value)
                                    setShowSortMenu(false)
                                    setShowMenu(false)
                                  }}
                                >
                                  {option.label}
                                </div>
                              ))}
                            </div>
                          )}
                          
                          <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                          
                          <div
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              transition: 'background 0.2s'
                            }}
                            onClick={() => {
                              handleIconSizeChange(iconSize === 'large' ? 'small' : 'large')
                              setShowMenu(false)
                            }}
                            onMouseEnter={e => e.target.style.background = theme.accent}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="18" height="18" rx="2"/>
                              <circle cx="8.5" cy="8.5" r="1.5"/>
                              <path d="M21 15l-5-5L5 21"/>
                            </svg>
                            {iconSize === 'large' ? t.header.icon_small : t.header.icon_large}
                          </div>
                          
                          <div style={{ height: 1, background: theme.border, margin: '4px 0' }} />
                          
                          <div
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              transition: 'background 0.2s'
                            }}
                            onClick={() => {
                              setIsMultiSelectMode(true)
                              setShowMenu(false)
                            }}
                            onMouseEnter={e => e.target.style.background = theme.accent}
                            onMouseLeave={e => e.target.style.background = 'transparent'}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="3" width="7" height="7" rx="1"/>
                              <rect x="14" y="3" width="7" height="7" rx="1"/>
                              <rect x="3" y="14" width="7" height="7" rx="1"/>
                              <rect x="14" y="14" width="7" height="7" rx="1"/>
                            </svg>
                            {t.header.multi_select}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {screenshots.length === 0 ? (
              <div style={styles.empty}>该游戏没有截图</div>
            ) : (
              <>
                <div style={styles.grid}>
                  {screenshots.map((ss, index) => (
                    <div 
                      key={ss.id} 
                      style={{ 
                        ...styles.card, 
                        ...(isMultiSelectMode ? styles.cardWithCheckbox : {}),
                        ...(isMultiSelectMode && selectedScreenshots.includes(ss.id) ? styles.cardSelected : {})
                      }}
                      onClick={(e) => {
                        if (isMultiSelectMode) {
                          toggleSelectScreenshot(ss.id)
                        } else {
                          setSelectedScreenshot(ss)
                          setSelectedScreenshotIndex(index)
                          setNoteText(ss.note || '')
                        }
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.transform = 'scale(1.03)'
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.transform = 'scale(1)'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                      onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.98)'
                      }}
                      onMouseUp={e => {
                        e.currentTarget.style.transform = 'scale(1.03)'
                      }}
                    >
                      {isMultiSelectMode && (
                        <div style={{
                          ...styles.selectCheckbox,
                          ...(selectedScreenshots.includes(ss.id) ? styles.selectCheckboxChecked : {})
                        }}>
                          {selectedScreenshots.includes(ss.id) && (
                            <div style={styles.selectCheckboxInner} />
                          )}
                        </div>
                      )}
                      <div style={{ 
                        width: '100%', 
                        aspectRatio: '16 / 9', 
                        background: theme.accent, 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}>
                        <img 
                          src={getImageSrc(ss.thumbnail_path)} 
                          alt="截图缩略图" 
                          style={{ 
                            width: '100%', 
                            height: '100%', 
                            objectFit: 'cover',
                            objectPosition: 'center center'
                          }}
                          onError={(e) => { e.target.style.display = 'none'; }}
                          loading="lazy"
                        />
                      </div>
                      <div style={styles.cardInfo}>
                        <div style={styles.cardDate}>{formatDate(ss.timestamp)}</div>
                        {ss.note && <div style={{ fontSize: 11, color: theme.text, marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis', lineHeight: '1.4' }}>{ss.note}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                
                {isLoadingMore && (
                  <div style={styles.loading}>加载更多...</div>
                )}
                
                <div style={styles.pagination}>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(1, selectedGame?.game_id)}
                    disabled={currentPage === 1}
                  >
                    首页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(Math.max(1, currentPage - 1), selectedGame?.game_id)}
                    disabled={currentPage === 1}
                  >
                    上一页
                  </button>
                  <span style={styles.paginationInfo}>
                    第 {currentPage} 页，共 {totalPages} 页
                  </span>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(Math.min(totalPages, currentPage + 1), selectedGame?.game_id)}
                    disabled={currentPage === totalPages}
                  >
                    下一页
                  </button>
                  <button 
                    style={styles.paginationBtn}
                    {...btnEvents}
                    onClick={() => loadScreenshotsWithPagination(totalPages, selectedGame?.game_id)}
                    disabled={currentPage === totalPages}
                  >
                    末页
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div>
            <h1 style={styles.title}>{t.settings.title}</h1>
            <div style={{ marginTop: 24 }}>
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.language}</h3>
                <select 
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    background: theme.primary, 
                    border: 'none', 
                    borderRadius: 6, 
                    color: theme.text, 
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  <option value="zh">{t.settings.languages.zh}</option>
                  <option value="en">{t.settings.languages.en}</option>
                  <option value="ja">{t.settings.languages.ja}</option>
                </select>
              </div>
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.theme}</h3>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {Object.entries(themes).map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setCurrentTheme(key)}
                      style={{
                        ...styles.themeBtn,
                        ...(currentTheme === key ? styles.themeBtnActive : {}),
                        background: t.colors.primary,
                        color: key === 'night' ? '#fff' : '#333',
                      }}
                      onMouseEnter={e => {
                        if (currentTheme !== key) {
                          e.currentTarget.style.transform = 'scale(1.05)'
                        }
                      }}
                      onMouseLeave={e => {
                        if (currentTheme !== key) {
                          e.currentTarget.style.transform = 'scale(1)'
                        }
                      }}
                      onMouseDown={e => {
                        e.currentTarget.style.transform = 'scale(0.95)'
                      }}
                      onMouseUp={e => {
                        e.currentTarget.style.transform = currentTheme === key ? 'scale(1.05)' : 'scale(1)'
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
              
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.storage}</h3>
                <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
                  {t.settings.current_path} {storagePath}
                </p>
                <button 
                  style={styles.btnPrimary} 
                  {...btnEvents}
                  onClick={changeStoragePath}
                  disabled={isMigrating}
                >
                  {isMigrating ? t.settings.migrating : t.settings.change_path}
                </button>
                {isMigrating && (
                  <div style={styles.migrationProgress}>
                    <div 
                      style={{
                        ...styles.migrationProgressBar,
                        width: `${migrationProgress}%`
                      }}
                    />
                  </div>
                )}
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  {t.settings.storage_hint}
                </p>
              </div>
              
              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.hotkeys}</h3>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.hotkey_print}</p>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.hotkey_f12}</p>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.system}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    id="autostart"
                    checked={autostart}
                    onChange={(e) => saveAutostart(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="autostart" style={{ cursor: 'pointer', color: theme.text }}>
                    {t.settings.autostart}
                  </label>
                </div>
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  {t.settings.autostart_hint}
                </p>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.screenshot}</h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="checkbox"
                    id="captureMouse"
                    checked={captureMouse}
                    onChange={(e) => saveCaptureMouse(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                  <label htmlFor="captureMouse" style={{ cursor: 'pointer', color: theme.text }}>
                    {t.settings.capture_mouse}
                  </label>
                </div>
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>
                  {t.settings.capture_mouse_hint}
                </p>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.delete_all}</h3>
                <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 12 }}>
                  {t.settings.delete_all_hint}
                </p>
                <button 
                  style={{ 
                    ...styles.btnDanger, 
                    width: '100%',
                    padding: '10px 16px',
                    fontSize: 14
                  }} 
                  {...btnEvents}
                  onClick={async () => {
                    if (confirm(t.settings.delete_all_confirm)) {
                      try {
                        await invoke('delete_all_data')
                        addLog('所有数据已删除')
                        alert(t.settings.restart_required)
                        await invoke('restart_app')
                      } catch (e) {
                        addLog(`删除所有数据失败: ${e}`)
                        alert(`删除失败: ${e}`)
                      }
                    }
                  }}
                >
                  {t.settings.delete_all}
                </button>
              </div>

              <div style={{ background: theme.card, padding: 16, borderRadius: 8 }}>
                <h3 style={{ marginBottom: 12 }}>{t.settings.about}</h3>
                <p style={{ color: theme.textMuted, fontSize: 14 }}>{t.settings.version}</p>
                <p style={{ color: theme.textMuted, fontSize: 12, marginTop: 8 }}>{t.settings.tech}</p>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedScreenshot && (
        <div 
          style={{
            ...styles.modal,
            animation: isModalClosing ? 'modalFadeOut 0.25s ease-in forwards' : 'modalFadeIn 0.3s ease-out'
          }} 
            onClick={closeModal}
          >
          <div 
            style={{
              ...styles.modalContent,
              width: '90vw',
              maxWidth: 1000,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={styles.modalHeader}>
              <h3>{formatDate(selectedScreenshot.timestamp)}</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 14, color: theme.textMuted }}>
                  {selectedScreenshotIndex + 1} / {screenshots.length}
                </span>
                <button style={styles.btn} {...btnEvents} onClick={closeModal}>关闭</button>
              </div>
            </div>
            
            <div style={{ 
              flex: 1, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              padding: 16,
              minHeight: 0
            }}>
              <img 
                src={getImageSrc(selectedScreenshot.file_path)} 
                alt="截图" 
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: 'calc(90vh - 280px)',
                  objectFit: 'contain'
                }} 
              />
            </div>
            
            <div style={{ 
              padding: '8px 16px',
              borderTop: `1px solid ${theme.border}`,
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: 24 
            }}>
              <button
                style={{
                  ...styles.btn,
                  opacity: selectedScreenshotIndex > 0 ? 1 : 0.5,
                  cursor: selectedScreenshotIndex > 0 ? 'pointer' : 'not-allowed'
                }}
                {...(selectedScreenshotIndex > 0 ? btnEvents : {})}
                onClick={() => navigateScreenshot('prev')}
                disabled={selectedScreenshotIndex === 0}
              >
                ← 上一张
              </button>
              <span style={{ fontSize: 14, color: theme.textMuted, minWidth: 60, textAlign: 'center' }}>
                {selectedScreenshotIndex + 1} / {screenshots.length}
              </span>
              <button
                style={{
                  ...styles.btn,
                  opacity: selectedScreenshotIndex < screenshots.length - 1 ? 1 : 0.5,
                  cursor: selectedScreenshotIndex < screenshots.length - 1 ? 'pointer' : 'not-allowed'
                }}
                {...(selectedScreenshotIndex < screenshots.length - 1 ? btnEvents : {})}
                onClick={() => navigateScreenshot('next')}
                disabled={selectedScreenshotIndex === screenshots.length - 1}
              >
                下一张 →
              </button>
            </div>
            
            <div style={styles.modalFooter}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label style={{ fontSize: 12, color: theme.textMuted }}>{t.header.note_hint}</label>
                  <span style={{ fontSize: 12, color: theme.textMuted }}>{t.header.note_shortcut}</span>
                </div>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => {
                    if (e.ctrlKey && e.key === 'Enter') {
                      e.preventDefault()
                      saveNote(selectedScreenshot.id, noteText)
                    }
                  }}
                  maxLength={120}
                  style={{ ...styles.input, height: 60, resize: 'none' }}
                  placeholder="写下你的感悟..."
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, color: theme.textMuted }}>游戏: {selectedScreenshot.display_title || selectedScreenshot.game_title}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button 
                    style={styles.btnPrimary}
                    {...btnEvents}
                    onClick={() => saveNote(selectedScreenshot.id, noteText)}
                  >
                    保存附注
                  </button>
                  <button 
                    style={styles.btn}
                    {...btnEvents}
                    onClick={() => openInExplorer(selectedScreenshot.file_path)}
                  >
                    打开文件夹
                  </button>
                  <button 
                    style={styles.btnDanger}
                    {...btnEvents}
                    onClick={() => deleteScreenshot(selectedScreenshot.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showSearchModal && (
        <div style={styles.modalOverlay} onClick={() => setShowSearchModal(false)}>
          <div style={{ ...styles.modalContent, maxWidth: 500, maxHeight: '80vh' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{t.search.title}</h2>
              <button style={styles.closeBtn} 
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'scale(1.2)'
                  e.currentTarget.style.color = theme.text
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.color = theme.textMuted
                }}
                onClick={() => setShowSearchModal(false)}>×</button>
            </div>
            
            {searchModalStep === 'source' && (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <p style={{ color: theme.textMuted, textAlign: 'center' }}>{t.search.select_source}</p>
                <button 
                  style={{ ...styles.btnPrimary, padding: 16, fontSize: 16 }}
                  {...btnEvents}
                  onClick={() => {
                    setSearchModalStep('steam')
                    setSteamSearchTerm(selectedGame?.display_title || selectedGame?.game_title || '')
                  }}
                >
                  Steam
                </button>
                <button 
                  style={{ ...styles.btn, padding: 16, fontSize: 16, opacity: 0.5, cursor: 'not-allowed' }}
                  disabled
                >
                  Bangumi ({t.search.coming_soon})
                </button>
              </div>
            )}
            
            {searchModalStep === 'steam' && (
              <div style={{ padding: 24 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    type="text"
                    value={steamSearchTerm}
                    onChange={e => setSteamSearchTerm(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key === 'Enter' && steamSearchTerm.trim()) {
                        setIsSearching(true)
                        try {
                          const results = await invoke('search_steam_games', { searchTerm: steamSearchTerm })
                          setSteamSearchResults(results)
                          if (results.length > 0) {
                            setSearchModalStep('results')
                          }
                        } catch (err) {
                          addLog(`搜索失败: ${err}`)
                        }
                        setIsSearching(false)
                      }
                    }}
                    placeholder={t.search.placeholder}
                    style={{ ...styles.input, flex: 1 }}
                    autoFocus
                  />
                  <button 
                    style={styles.btnPrimary}
                    {...btnEvents}
                    onClick={async () => {
                      if (steamSearchTerm.trim()) {
                        setIsSearching(true)
                        try {
                          const results = await invoke('search_steam_games', { searchTerm: steamSearchTerm })
                          setSteamSearchResults(results)
                          if (results.length > 0) {
                            setSearchModalStep('results')
                          }
                        } catch (err) {
                          addLog(`搜索失败: ${err}`)
                        }
                        setIsSearching(false)
                      }
                    }}
                    disabled={isSearching}
                  >
                    {isSearching ? t.search.searching : t.search.search}
                  </button>
                </div>
                <button 
                  style={{ ...styles.btn, width: '100%' }}
                  {...btnEvents}
                  onClick={() => setSearchModalStep('source')}
                >
                  {t.search.back}
                </button>
              </div>
            )}
            
            {searchModalStep === 'results' && (
              <div style={{ padding: 24 }}>
                {isApplyingInfo ? (
                  <div style={{ textAlign: 'center', padding: 32 }}>
                    <div style={{ 
                      width: 40, 
                      height: 40, 
                      border: `3px solid ${theme.border}`,
                      borderTop: `3px solid ${theme.primary}`,
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                      margin: '0 auto 16px'
                    }} />
                    <style>{`
                      @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                    `}</style>
                    <p style={{ color: theme.text }}>{t.search.applying}</p>
                  </div>
                ) : (
                  <>
                    <p style={{ color: theme.textMuted, marginBottom: 16 }}>
                      {t.search.found_results.replace('{count}', steamSearchResults.length)}
                    </p>
                    <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {steamSearchResults.map(result => (
                        <div 
                          key={result.appid}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 12, 
                            padding: 12, 
                            background: theme.accent, 
                            borderRadius: 8, 
                            cursor: 'pointer',
                            transition: 'transform 0.15s, background 0.15s'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.transform = 'scale(1.02)'
                            e.currentTarget.style.background = theme.card
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.transform = 'scale(1)'
                            e.currentTarget.style.background = theme.accent
                          }}
                          onMouseDown={e => {
                            e.currentTarget.style.transform = 'scale(0.98)'
                          }}
                          onMouseUp={e => {
                            e.currentTarget.style.transform = 'scale(1.02)'
                          }}
                          onClick={async () => {
                            setIsApplyingInfo(true)
                            try {
                              addLog(`正在应用 ${result.name} 的信息...`)
                              const info = await invoke('apply_steam_game_info', {
                                gameId: selectedGame?.game_id,
                                appid: result.appid
                              })
                              addLog(`已应用: ${info.name}`)
                              setAppliedGameName(info.name)
                              setShowSearchModal(false)
                              setShowApplySuccess(true)
                              await loadGames()
                              const updatedGame = games.find(g => g.game_id === selectedGame?.game_id)
                              if (updatedGame) {
                                setSelectedGame(updatedGame)
                              }
                            } catch (err) {
                              addLog(`应用失败: ${err}`)
                            }
                            setIsApplyingInfo(false)
                          }}
                        >
                          {result.tiny_image && (
                            <img 
                              src={result.tiny_image} 
                              alt={result.name}
                              style={{ width: 60, height: 30, objectFit: 'cover', borderRadius: 4 }}
                            />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 500 }}>{result.name}</div>
                            <div style={{ fontSize: 12, color: theme.textMuted }}>AppID: {result.appid}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button 
                      style={{ ...styles.btn, width: '100%', marginTop: 16 }}
                      {...btnEvents}
                      onClick={() => setSearchModalStep('steam')}
                    >
                      {t.search.back}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
      
      {showApplySuccess && (
        <div style={styles.modalOverlay} onClick={() => setShowApplySuccess(false)}>
          <div style={{ ...styles.modalContent, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div style={{ padding: 32, textAlign: 'center' }}>
              <div style={{ 
                width: 60, 
                height: 60, 
                borderRadius: '50%', 
                background: theme.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h3 style={{ marginBottom: 8 }}>{t.search.apply_success}</h3>
              <p style={{ color: theme.textMuted, marginBottom: 24 }}>{appliedGameName}</p>
              <button 
                style={{ ...styles.btnPrimary, padding: '12px 32px' }}
                {...btnEvents}
                onClick={() => setShowApplySuccess(false)}
              >
                {t.search.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
      
      {screenshotNotification && (
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          background: 'rgba(30, 30, 40, 0.95)',
          borderRadius: 8,
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 10001,
          animation: 'slideInRight 0.3s ease-out',
          minWidth: 220
        }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #4CAF50, #45a049)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div>
            <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>截图成功</div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>已保存到本地</div>
          </div>
        </div>
      )}
      
      {showGuide && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10002,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div style={{
            background: currentTheme === 'night' ? '#1a1a2e' : '#fff',
            borderRadius: 16,
            padding: 32,
            maxWidth: 500,
            width: '90%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            animation: 'scaleIn 0.3s ease-out'
          }}>
            {guideStep === 0 && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 24 }}>
                  <svg width="64" height="64" viewBox="0 0 100 100" fill="none" style={{ marginBottom: 16 }}>
                    <rect x="10" y="10" width="80" height="80" rx="16" fill="url(#guideGradient)" />
                    <path d="M30 50 L45 65 L70 35" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                    <defs>
                      <linearGradient id="guideGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style={{ stopColor: '#667eea' }} />
                        <stop offset="100%" style={{ stopColor: '#764ba2' }} />
                      </linearGradient>
                    </defs>
                  </svg>
                  <h2 style={{ color: currentTheme === 'night' ? '#fff' : '#333', margin: 0, fontSize: 24 }}>欢迎使用极简游戏截图管理器</h2>
                </div>
                <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.8)' : '#666', lineHeight: 1.8, textAlign: 'center' }}>
                  这是一款专为游戏玩家设计的截图管理工具，帮助您轻松管理游戏截图。
                </p>
              </>
            )}
            
            {guideStep === 1 && (
              <>
                <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📸</span> 快速截图
                </h3>
                <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.8)' : '#666', lineHeight: 1.8 }}>
                  按下 <strong style={{ color: '#667eea' }}>PrintScreen</strong> 键即可截图。程序会自动识别当前运行的游戏，并将截图保存到本地。
                </p>
                <div style={{ 
                  background: currentTheme === 'night' ? 'rgba(102, 126, 234, 0.1)' : '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 8, 
                  marginTop: 16,
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <span style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.6)' : '#888', fontSize: 13 }}>💡 提示：截图时会播放提示音</span>
                </div>
              </>
            )}
            
            {guideStep === 2 && (
              <>
                <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>🎮</span> 游戏识别
                </h3>
                <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.8)' : '#666', lineHeight: 1.8 }}>
                  程序会自动识别游戏名称，并支持手动匹配 Steam 游戏信息，获取游戏封面和详细资料。
                </p>
                <div style={{ 
                  background: currentTheme === 'night' ? 'rgba(102, 126, 234, 0.1)' : '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 8, 
                  marginTop: 16,
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <span style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.6)' : '#888', fontSize: 13 }}>💡 提示：点击游戏卡片可以匹配 Steam 信息</span>
                </div>
              </>
            )}
            
            {guideStep === 3 && (
              <>
                <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 24 }}>📁</span> 数据管理
                </h3>
                <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.8)' : '#666', lineHeight: 1.8 }}>
                  所有截图保存在本地，支持添加备注、批量删除、数据迁移等功能。程序最小化后会驻留系统托盘，随时待命。
                </p>
                <div style={{ 
                  background: currentTheme === 'night' ? 'rgba(102, 126, 234, 0.1)' : '#f5f5f5', 
                  padding: 12, 
                  borderRadius: 8, 
                  marginTop: 16,
                  border: '1px solid rgba(102, 126, 234, 0.3)'
                }}>
                  <span style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.6)' : '#888', fontSize: 13 }}>💡 提示：点击托盘图标可以快速打开主界面</span>
                </div>
              </>
            )}
            
            <div style={{ 
              marginTop: 24, 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              paddingTop: 16,
              borderTop: `1px solid ${currentTheme === 'night' ? 'rgba(255,255,255,0.1)' : '#eee'}`
            }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                cursor: 'pointer',
                color: currentTheme === 'night' ? 'rgba(255,255,255,0.6)' : '#888',
                fontSize: 13
              }}>
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                以后不再显示
              </label>
              
              <div style={{ display: 'flex', gap: 8 }}>
                {guideStep > 0 && (
                  <button
                    onClick={() => setGuideStep(guideStep - 1)}
                    style={{
                      padding: '10px 20px',
                      background: 'transparent',
                      border: `1px solid ${currentTheme === 'night' ? 'rgba(255,255,255,0.2)' : '#ddd'}`,
                      borderRadius: 8,
                      color: currentTheme === 'night' ? '#fff' : '#333',
                      cursor: 'pointer',
                      fontSize: 14,
                      transition: 'all 0.2s'
                    }}
                  >
                    上一步
                  </button>
                )}
                
                {guideStep < 3 ? (
                  <button
                    onClick={() => setGuideStep(guideStep + 1)}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    下一步
                  </button>
                ) : (
                  <button
                    onClick={async () => {
                      if (dontShowAgain) {
                        localStorage.setItem('hideGuide', 'true')
                      }
                      setShowGuide(false)
                      try {
                        await invoke('hide_window')
                        addLog('向导完成，窗口已最小化')
                      } catch (e) {
                        addLog(`最小化窗口失败: ${e}`)
                      }
                    }}
                    style={{
                      padding: '10px 24px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      border: 'none',
                      borderRadius: 8,
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    开始使用
                  </button>
                )}
              </div>
            </div>
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: 8, 
              marginTop: 16 
            }}>
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === guideStep 
                      ? 'linear-gradient(135deg, #667eea, #764ba2)' 
                      : currentTheme === 'night' ? 'rgba(255,255,255,0.2)' : '#ddd',
                    transition: 'all 0.2s'
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  )
}

export default App
