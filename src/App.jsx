import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'

import { themes } from './styles/themes'
import { getTranslation } from './i18n/translations'
import { createStyles, btnEvents, modalKeyframes } from './styles/sharedStyles'
import { 
  Sidebar, 
  ScreenshotGrid, 
  ScreenshotModal,
  GameList, 
  GameDetail, 
  SettingsPanel,
  AddGameModal,
  ImportModal,
  ErrorBoundary,
  ShareModal,
  TitleBar 
} from './components'

function getImageSrc(path) {
  if (!path) return ''
  if (path.startsWith('http')) return path
  try {
    return convertFileSrc(path)
  } catch {
    return path
  }
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000)
  return date.toLocaleString()
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
  const [showDebug, setShowDebug] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [currentTheme, setCurrentTheme] = useState('night')
  
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedScreenshots, setSelectedScreenshots] = useState([])
  
  const showNotification = useCallback((title, body = '', duration = 3000) => {
    setNotification({ title, body })
    setTimeout(() => setNotification(null), duration)
  }, [])
  
  const [storagePath, setStoragePath] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState(0)
  const [migrationTotal, setMigrationTotal] = useState(0)
  const [migrationStatus, setMigrationStatus] = useState('')
  const [migrationStats, setMigrationStats] = useState(null)
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showScreenshotDeleteConfirm, setShowScreenshotDeleteConfirm] = useState(false)
  const [screenshotToDelete, setScreenshotToDelete] = useState(null)
  const [multiDeleteCount, setMultiDeleteCount] = useState(0)
  
  const [shutterSound, setShutterSound] = useState('default')
  const [autostart, setAutostart] = useState(false)
  const [language, setLanguage] = useState('zh')
  const [steamLanguage, setSteamLanguage] = useState('schinese')
  const [screenshotFormat, setScreenshotFormat] = useState('webp')
  const [screenshotQuality, setScreenshotQuality] = useState('medium')
  
  const [bangumiAccessToken, setBangumiAccessToken] = useState('')
  const [bangumiCookie, setBangumiCookie] = useState('')
  
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchModalStep, setSearchModalStep] = useState('source')
  const [searchSource, setSearchSource] = useState('steam')
  const [steamSearchTerm, setSteamSearchTerm] = useState('')
  const [steamSearchResults, setSteamSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [isApplyingInfo, setIsApplyingInfo] = useState(false)
  const [showApplySuccess, setShowApplySuccess] = useState(false)
  const [appliedGameName, setAppliedGameName] = useState('')
  const [screenshotNotification, setScreenshotNotification] = useState(false)
  
  const [showAddGameModal, setShowAddGameModal] = useState(false)
  const [addGameStep, setAddGameStep] = useState('platform')
  const [addGameSearchTerm, setAddGameSearchTerm] = useState('')
  const [addGameSearchResults, setAddGameSearchResults] = useState([])
  const [isAddingGame, setIsAddingGame] = useState(false)
  const [addGameSource, setAddGameSource] = useState('steam')
  
  const [isGameMultiSelectMode, setIsGameMultiSelectMode] = useState(false)
  const [selectedGames, setSelectedGames] = useState([])
  
  const [showDeleteGameConfirm, setShowDeleteGameConfirm] = useState(false)
  const [deleteGameCallback, setDeleteGameCallback] = useState(null)
  const [deleteConfirmMode, setDeleteConfirmMode] = useState('last_screenshot')
  
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFiles, setImportFiles] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(null)
  const [importResult, setImportResult] = useState(null)
  
  const [showGameListMenu, setShowGameListMenu] = useState(false)
  const [showGameDetailMenu, setShowGameDetailMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  
  const [importConfirmPath, setImportConfirmPath] = useState(null)
  
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareScreenshot, setShareScreenshot] = useState(null)
  const [shareUsername, setShareUsername] = useState(() => {
    const saved = localStorage.getItem('shareUsername')
    return saved || ''
  })
  
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closeAction, setCloseAction] = useState(() => {
    const saved = localStorage.getItem('closeAction')
    return saved || ''
  })
  
  const refreshDebounceRef = useRef(null)
  const isRefreshingRef = useRef(false)
  const selectedGameRef = useRef(null)
  const sortOrderRef = useRef(sortOrder)
  const gridRef = useRef(null)

  const theme = themes[currentTheme].colors
  const t = getTranslation(language)
  const styles = createStyles(theme, iconSize)

  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}] ${msg}`)
    setLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`])
  }, [])

  useEffect(() => {
    selectedGameRef.current = selectedGame
    console.log(`[DEBUG] selectedGameRef 更新: ${selectedGame?.game_id || 'null'}`)
  }, [selectedGame])

  useEffect(() => {
    sortOrderRef.current = sortOrder
    console.log(`[DEBUG] sortOrderRef 更新: ${sortOrder}`)
  }, [sortOrder])

  const showScreenshotNotification = useCallback(() => {
    setScreenshotNotification(true)
    setTimeout(() => {
      setScreenshotNotification(false)
    }, 2000)
  }, [])

  const toggleSidebar = useCallback(() => {
    const newState = !sidebarCollapsed
    setSidebarCollapsed(newState)
    localStorage.setItem('sidebarCollapsed', String(newState))
  }, [sidebarCollapsed])

  const handleIconSizeChange = useCallback((size) => {
    setIconSize(size)
    localStorage.setItem('iconSize', size)
  }, [])

  const loadGames = useCallback(async (sortType = null) => {
    try {
      addLog('调用 get_all_games_with_empty')
      const gData = await invoke('get_all_games_with_empty')
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
  }, [addLog, gameSortOrder])

  const loadScreenshotsWithPagination = useCallback(async (page, gameId = null) => {
    try {
      addLog(`加载截图: 页码=${page}, 游戏ID=${gameId || '全部'}`)
      const result = await invoke('get_screenshots_with_pagination', {
        gameId: gameId,
        sortOrder: sortOrderRef.current,
        page: page,
        pageSize: pageSize
      })
      
      console.log(`[DEBUG] loadScreenshotsWithPagination 返回 ${result.screenshots.length} 条截图`)
      console.log(`[DEBUG] 截图ID列表:`, result.screenshots.map(s => s.id))
      
      setScreenshots(result.screenshots)
      setCurrentPage(result.page)
      setTotalPages(result.total_pages)
      addLog(`截图加载完成: ${result.screenshots.length} 条`)
    } catch (e) {
      addLog(`截图加载失败: ${e}`)
      setError('加载截图失败: ' + String(e))
    }
  }, [addLog, pageSize])

  const loadStoragePath = useCallback(async () => {
    try {
      const path = await invoke('get_storage_path')
      setStoragePath(path || '程序目录/screenshot-data/')
    } catch (e) {
      addLog(`获取存储路径失败: ${e}`)
    }
  }, [addLog])

  const loadBangumiAuth = useCallback(async () => {
    try {
      const auth = await invoke('get_bangumi_auth')
      setBangumiAccessToken(auth.access_token || '')
      setBangumiCookie(auth.cookie || '')
    } catch (e) {
      addLog(`加载 Bangumi 认证信息失败: ${e}`)
    }
  }, [addLog])

  const handleBangumiAuthChange = useCallback((accessToken, cookie, shouldSave = false) => {
    setBangumiAccessToken(accessToken || '')
    setBangumiCookie(cookie || '')
    
    if (shouldSave) {
      invoke('save_bangumi_auth', { 
        accessToken: accessToken || null, 
        cookie: cookie || null 
      })
        .then(() => addLog('Bangumi 认证信息已保存'))
        .catch(e => addLog(`保存 Bangumi 认证信息失败: ${e}`))
    }
  }, [addLog])

  const loadShutterSound = useCallback(async () => {
    try {
      const sound = await invoke('get_shutter_sound')
      setShutterSound(sound || 'default')
    } catch (e) {
      addLog(`获取音效设置失败: ${e}`)
    }
  }, [addLog])

  const saveShutterSound = useCallback(async (soundType) => {
    try {
      await invoke('set_shutter_sound', { soundType })
      setShutterSound(soundType)
      addLog(`音效设置已保存: ${soundType}`)
    } catch (e) {
      addLog(`保存音效设置失败: ${e}`)
    }
  }, [addLog])

  const playSoundPreview = useCallback(async (soundType) => {
    try {
      await invoke('play_sound_preview', { soundType })
    } catch (e) {
      addLog(`播放音效预览失败: ${e}`)
    }
  }, [addLog])

  const loadScreenshotQuality = useCallback(async () => {
    try {
      const format = await invoke('get_setting', { key: 'screenshot_format' })
      const quality = await invoke('get_setting', { key: 'screenshot_quality' })
      if (format) setScreenshotFormat(format)
      if (quality) setScreenshotQuality(quality)
    } catch (e) {
      addLog(`获取截图质量设置失败: ${e}`)
    }
  }, [addLog])

  const saveScreenshotFormat = useCallback(async (format) => {
    try {
      await invoke('set_setting', { key: 'screenshot_format', value: format })
      setScreenshotFormat(format)
      addLog(`截图格式设置已保存: ${format}`)
      showNotification(`截图格式已设置为 ${format.toUpperCase()}`)
    } catch (e) {
      addLog(`保存截图格式设置失败: ${e}`)
    }
  }, [addLog, showNotification])

  const saveScreenshotQuality = useCallback(async (quality) => {
    try {
      await invoke('set_setting', { key: 'screenshot_quality', value: quality })
      setScreenshotQuality(quality)
      addLog(`截图质量设置已保存: ${quality}`)
      showNotification(`截图质量已设置为${quality === 'low' ? '低' : quality === 'medium' ? '中' : '高'}`)
    } catch (e) {
      addLog(`保存截图质量设置失败: ${e}`)
    }
  }, [addLog, showNotification])

  const loadAutostart = useCallback(async () => {
    try {
      const { isEnabled, enable } = await import('@tauri-apps/plugin-autostart')
      const enabled = await isEnabled()
      if (!enabled) {
        await enable()
        setAutostart(true)
        addLog('开机自启动已默认启用')
      } else {
        setAutostart(true)
        addLog(`开机自启动状态: ${enabled}`)
      }
    } catch (e) {
      addLog(`获取开机自启动设置失败: ${e}`)
    }
  }, [addLog])

  const saveAutostart = useCallback(async (enabled) => {
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
  }, [addLog])

  const switchToTimeView = useCallback(() => {
    console.log('[DEBUG] switchToTimeView called, resetting menus')
    setCurrentView('time')
    setSelectedGame(null)
    setShowGameListMenu(false)
    setShowGameDetailMenu(false)
    setShowSortMenu(false)
    loadScreenshotsWithPagination(1, null)
  }, [loadScreenshotsWithPagination])

  const switchToGames = useCallback(() => {
    console.log('[DEBUG] switchToGames called, resetting menus')
    setCurrentView('games')
    setSelectedGame(null)
    setShowGameListMenu(false)
    setShowGameDetailMenu(false)
    setShowSortMenu(false)
    loadGames()
  }, [loadGames])

  const selectGame = useCallback(async (game) => {
    console.log('[DEBUG] selectGame called, resetting menus')
    setSelectedGame(game)
    setCurrentView('game-detail')
    setShowGameListMenu(false)
    setShowGameDetailMenu(false)
    setShowSortMenu(false)
    await loadScreenshotsWithPagination(1, game.game_id)
  }, [loadScreenshotsWithPagination])

  const backToGames = useCallback(() => {
    console.log('[DEBUG] backToGames called, resetting menus')
    setCurrentView('games')
    setSelectedGame(null)
    setShowGameListMenu(false)
    setShowGameDetailMenu(false)
    setShowSortMenu(false)
    loadGames()
  }, [loadGames])

  const handleSortChange = useCallback(async (newOrder) => {
    setSortOrder(newOrder)
    sortOrderRef.current = newOrder
    await loadScreenshotsWithPagination(1, selectedGameRef.current?.game_id || null)
  }, [loadScreenshotsWithPagination])

  const handleGameSortChange = useCallback(async (newOrder) => {
    setGameSortOrder(newOrder)
    await loadGames(newOrder)
  }, [loadGames])

  const closeModal = useCallback(() => {
    setIsModalClosing(true)
    setTimeout(() => {
      setSelectedScreenshot(null)
      setIsModalClosing(false)
    }, 250)
  }, [])

  const navigateScreenshot = useCallback((direction) => {
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
  }, [selectedScreenshot, selectedScreenshotIndex, screenshots])

  const saveNote = useCallback(async (id, note) => {
    try {
      await invoke('update_note', { id, note })
      addLog(`附注保存成功: ID=${id}`)
      
      setScreenshots(prev => prev.map(ss => 
        ss.id === id ? { ...ss, note } : ss
      ))
      
      setSelectedScreenshot(prev => prev ? { ...prev, note } : prev)
      
      showNotification(t.header.note_saved)
    } catch (e) {
      addLog(`附注保存失败: ${e}`)
      setError('保存附注失败: ' + String(e))
    }
  }, [addLog, t])

  const doDeleteScreenshot = useCallback(async (id) => {
    const currentGameId = selectedGameRef.current?.game_id
    
    try {
      await invoke('delete_screenshot', { id })
      addLog(`截图删除成功: ID=${id}`)
      showNotification(t.notifications.delete_success)
      
      closeModal()
      
      if (selectedGameRef.current) {
        await loadGames()
      }
      await loadScreenshotsWithPagination(1, currentGameId || null)
    } catch (e) {
      addLog(`截图删除失败: ${e}`)
      setError('删除截图失败: ' + String(e))
    }
  }, [addLog, closeModal, loadGames, loadScreenshotsWithPagination, t, showNotification])

  const deleteScreenshot = useCallback((id) => {
    setScreenshotToDelete(id)
    setMultiDeleteCount(0)
    setShowScreenshotDeleteConfirm(true)
  }, [])

  const doDeleteSelectedScreenshots = useCallback(async () => {
    const deleteCount = selectedScreenshots.length
    const currentGameId = selectedGameRef.current?.game_id
    
    try {
      await invoke('delete_screenshots', { ids: selectedScreenshots })
      addLog(`批量删除成功: ${deleteCount} 张`)
      
      setIsMultiSelectMode(false)
      setSelectedScreenshots([])
      showNotification('删除成功', `已删除 ${deleteCount} 张截图`)
      
      await loadGames()
      await loadScreenshotsWithPagination(1, currentGameId || null)
    } catch (e) {
      addLog(`批量删除失败: ${e}`)
      setError('批量删除失败: ' + String(e))
    }
  }, [selectedScreenshots, addLog, loadScreenshotsWithPagination, loadGames, showNotification])

  const deleteSelectedScreenshots = useCallback(() => {
    if (selectedScreenshots.length === 0) return
    setScreenshotToDelete(null)
    setMultiDeleteCount(selectedScreenshots.length)
    setShowScreenshotDeleteConfirm(true)
  }, [selectedScreenshots])

  const openInExplorer = useCallback(async (filePath) => {
    try {
      await invoke('open_in_explorer', { filePath })
      addLog(`打开文件夹: ${filePath}`)
    } catch (e) {
      addLog(`打开文件夹失败: ${e}`)
      setError('打开文件夹失败: ' + String(e))
    }
  }, [addLog])

  const toggleSelectScreenshot = useCallback((id) => {
    setSelectedScreenshots(prev => {
      if (prev.includes(id)) {
        return prev.filter(sid => sid !== id)
      } else {
        return [...prev, id]
      }
    })
  }, [])

  const changeStoragePath = useCallback(async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择新的存储目录'
      })
      
      if (!selectedPath) return
      
      setIsMigrating(true)
      setMigrationProgress(0)
      setMigrationTotal(0)
      setMigrationStatus('准备迁移...')
      setMigrationStats(null)
      
      addLog(`开始迁移数据到: ${selectedPath}`)
      const result = await invoke('migrate_data', { newPath: selectedPath })
      
      if (result.success) {
        setStoragePath(selectedPath)
        setMigrationStats(result.stats)
        showNotification('迁移成功', '数据已成功迁移到新目录')
      } else {
        setError('迁移失败: ' + (result.error || '未知错误'))
      }
    } catch (e) {
      addLog(`更改存储路径失败: ${e}`)
      setError('更改存储路径失败: ' + String(e))
    } finally {
      setIsMigrating(false)
      setMigrationStatus('')
    }
  }, [addLog])

  const importExistingDirectory = useCallback(async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: '选择已有数据目录'
      })
      
      if (!selectedPath) return
      
      const result = await invoke('check_data_directory', { path: selectedPath })
      
      if (!result.valid) {
        setError(result.message || '所选目录不是有效的数据目录')
        return
      }
      
      setImportConfirmPath(selectedPath)
    } catch (e) {
      addLog(`检查目录失败: ${e}`)
      setError('检查目录失败: ' + String(e))
    }
  }, [addLog])

  const confirmImportDirectory = useCallback(async () => {
    if (!importConfirmPath) return
    
    try {
      setIsMigrating(true)
      addLog(`切换数据目录到: ${importConfirmPath}`)
      const result = await invoke('switch_data_directory', { newPath: importConfirmPath })
      
      if (result.success) {
        setMigrationStats({ ...result.stats, is_import: true })
        showNotification('导入成功', '数据目录已切换')
      } else {
        setError('导入失败: ' + (result.error || '未知错误'))
      }
    } catch (e) {
      addLog(`切换数据目录失败: ${e}`)
      setError('切换数据目录失败: ' + String(e))
    } finally {
      setIsMigrating(false)
      setImportConfirmPath(null)
    }
  }, [importConfirmPath, addLog])

  const handleScroll = useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target
    if (scrollHeight - scrollTop - clientHeight < 100 && !isLoadingMore && currentPage < totalPages) {
      setIsLoadingMore(true)
      loadScreenshotsWithPagination(currentPage + 1, selectedGameRef.current?.game_id || null)
        .finally(() => setIsLoadingMore(false))
    }
  }, [isLoadingMore, currentPage, totalPages, loadScreenshotsWithPagination])

  const handleAddGame = useCallback(async (action, data) => {
    if (action === 'search') {
      setIsAddingGame(true)
      setAddGameSource('steam')
      try {
        const results = await invoke('search_steam_games', { searchTerm: data, language: steamLanguage })
        setAddGameSearchResults(results)
        if (results.length > 0) {
          setAddGameStep('results')
        }
      } catch (err) {
        addLog(`搜索失败: ${err}`)
      }
      setIsAddingGame(false)
    } else if (action === 'bangumi-search') {
      setIsAddingGame(true)
      setAddGameSource('bangumi')
      try {
        const results = await invoke('search_bangumi_games', { searchTerm: data })
        setAddGameSearchResults(results.map(r => ({
          appid: r.id,
          name: language === 'zh' ? (r.name_cn || r.name) : r.name,
          tiny_image: r.image
        })))
        if (results.length > 0) {
          setAddGameStep('results')
        }
      } catch (err) {
        addLog(`Bangumi搜索失败: ${err}`)
      }
      setIsAddingGame(false)
    } else if (action === 'create') {
      setIsAddingGame(true)
      try {
        const game = await invoke('create_game_from_steam', {
          appid: data.appid,
          gameName: data.name,
          language: steamLanguage
        })
        addLog(`创建游戏成功: ${game.display_title}`)
        setShowAddGameModal(false)
        await loadGames()
        showNotification(t.add_game.create_success, game.display_title)
      } catch (err) {
        addLog(`创建游戏失败: ${err}`)
        if (err.includes('已存在')) {
          showNotification(t.add_game.already_exists)
        }
      }
      setIsAddingGame(false)
    } else if (action === 'create-bangumi') {
      setIsAddingGame(true)
      try {
        const game = await invoke('create_game_from_bangumi', {
          subjectId: data.appid,
          gameName: data.name,
          language: language
        })
        addLog(`创建游戏成功: ${game.display_title}`)
        setShowAddGameModal(false)
        await loadGames()
        showNotification(t.add_game.create_success, game.display_title)
      } catch (err) {
        addLog(`创建游戏失败: ${err}`)
        if (err.includes('已存在')) {
          showNotification(t.add_game.already_exists)
        }
      }
      setIsAddingGame(false)
    }
  }, [steamLanguage, addLog, loadGames, t])

  const handleImport = useCallback(async () => {
    if (importFiles.length === 0 || !selectedGame) return
    
    const currentGameId = selectedGame.game_id
    
    setIsImporting(true)
    setImportProgress({ current: 0, total: importFiles.length, current_file: '', status: '准备中' })
    setImportResult(null)
    
    let unlisten = null
    try {
      const { listen } = await import('@tauri-apps/api/event')
      unlisten = await listen('import-progress', (event) => {
        setImportProgress(event.payload)
      })
      
      const result = await invoke('import_screenshots', {
        gameId: selectedGame.game_id,
        displayTitle: selectedGame.display_title || selectedGame.game_title,
        files: importFiles
      })
      
      addLog(`导入完成: ${result.imported_count} 成功, ${result.skipped_count} 跳过, ${result.failed_count} 失败, 耗时 ${result.duration_ms}ms`)
      setShowImportModal(false)
      setImportFiles([])
      setImportProgress(null)
      setImportResult(result)
      await loadScreenshotsWithPagination(1, currentGameId)
    } catch (e) {
      addLog(`导入失败: ${e}`)
      showNotification(t.import.import_failed.replace('{error}', e))
      setImportProgress(null)
    } finally {
      if (unlisten) unlisten()
      setIsImporting(false)
    }
  }, [importFiles, selectedGame, addLog, loadScreenshotsWithPagination, t])

  useEffect(() => {
    addLog('useEffect 初始化')
    
    const loadData = async () => {
      addLog('开始加载数据')
      try {
        await loadStoragePath()
        await loadShutterSound()
        await loadAutostart()
        await loadBangumiAuth()
        await loadScreenshotQuality()
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

    const unlisten = listen('screenshot-taken', (event) => {
      const payload = event.payload || {}
      const gameId = payload.game_id
      console.log(`[DEBUG] 收到screenshot-taken事件:`, event)
      console.log(`[DEBUG] payload:`, payload)
      console.log(`[DEBUG] gameId: ${gameId}`)
      console.log(`[DEBUG] selectedGameRef.current: ${selectedGameRef.current?.game_id || 'null'}`)
      addLog(`收到截图事件，游戏ID: ${gameId || '未知'}`)
      showScreenshotNotification()
      
      if (refreshDebounceRef.current) {
        console.log(`[DEBUG] 清除之前的防抖定时器`)
        clearTimeout(refreshDebounceRef.current)
      }
      
      refreshDebounceRef.current = setTimeout(async () => {
        console.log(`[DEBUG] 防抖定时器触发，准备刷新`)
        console.log(`[DEBUG] isRefreshingRef.current: ${isRefreshingRef.current}`)
        
        if (isRefreshingRef.current) {
          addLog('刷新进行中，跳过')
          return
        }
        
        isRefreshingRef.current = true
        console.log(`[DEBUG] 开始刷新数据`)
        
        try {
          const currentSelectedGame = selectedGameRef.current
          console.log(`[DEBUG] currentSelectedGame: ${currentSelectedGame?.game_id || 'null'}`)
          console.log(`[DEBUG] gameId: ${gameId}`)
          
          // 如果当前在某个游戏的详情页
          if (currentSelectedGame) {
            // 只有新截图属于当前游戏时才刷新
            if (gameId && currentSelectedGame.game_id === gameId) {
              addLog(`刷新当前游戏截图: ${gameId}`)
              console.log(`[DEBUG] 调用 loadScreenshotsWithPagination(1, ${gameId})`)
              await loadScreenshotsWithPagination(1, gameId)
            } else {
              // 新截图属于其他游戏，只刷新游戏列表，不刷新当前截图
              addLog(`新截图属于其他游戏，只刷新游戏列表`)
              console.log(`[DEBUG] 只刷新游戏列表`)
              await loadGames()
            }
          } else {
            // 当前在全部截图页面，刷新所有截图和游戏列表
            addLog(`刷新所有截图和游戏列表`)
            console.log(`[DEBUG] 调用 loadScreenshotsWithPagination(1, null) 和 loadGames()`)
            await loadScreenshotsWithPagination(1, null)
            await loadGames()
          }
          console.log(`[DEBUG] 刷新完成`)
        } catch (error) {
          console.error(`[DEBUG] 刷新失败:`, error)
          addLog(`刷新失败: ${error}`)
        } finally {
          isRefreshingRef.current = false
        }
      }, 100)
    })

    return () => {
      console.log(`[DEBUG] 清理screenshot-taken事件监听器`)
      unlisten.then(fn => fn())
    }
  }, [])

  useEffect(() => {
    const setupWindowListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event')
      
      const unlistenClose = await listen('close-requested', () => {
        addLog('收到关闭请求')
        if (closeAction) {
          if (closeAction === 'minimize') {
            invoke('minimize_to_tray')
          } else {
            invoke('close_app')
          }
        } else {
          setShowCloseConfirm(true)
        }
      })
      
      const unlistenFocused = await listen('window-focused', async () => {
        addLog('窗口获得焦点，刷新数据')
        loadGames()
        if (selectedGameRef.current) {
          loadScreenshotsWithPagination(1, selectedGameRef.current.game_id)
        } else {
          loadScreenshotsWithPagination(1, null)
        }
        try {
          await invoke('reset_unread_count')
          addLog('未读数量已重置')
        } catch (e) {
          addLog(`重置未读数量失败: ${e}`)
        }
      })
      
      const unlistenShown = await listen('window-shown', async () => {
        addLog('窗口显示，刷新数据')
        loadGames()
        if (selectedGameRef.current) {
          loadScreenshotsWithPagination(1, selectedGameRef.current.game_id)
        } else {
          loadScreenshotsWithPagination(1, null)
        }
        try {
          await invoke('reset_unread_count')
          addLog('未读数量已重置')
        } catch (e) {
          addLog(`重置未读数量失败: ${e}`)
        }
      })
      
      return () => {
        unlistenClose()
        unlistenFocused()
        unlistenShown()
      }
    }
    
    const cleanup = setupWindowListeners()
    return () => {
      cleanup.then(fn => fn())
    }
  }, [closeAction, addLog, loadGames, loadScreenshotsWithPagination])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F5') {
        e.preventDefault()
        setShowDebug(prev => !prev)
        addLog(`调试窗口: ${!showDebug ? '显示' : '隐藏'}`)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showDebug, addLog])

  return (
    <ErrorBoundary>
      <style>{modalKeyframes}</style>
      
      <div style={{ 
        ...styles.container, 
        flexDirection: 'column',
        paddingTop: 0
      }}>
        <TitleBar 
          theme={theme} 
          t={t} 
          onCloseConfirm={() => setShowCloseConfirm(true)}
        />
        
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <Sidebar
            theme={theme}
            styles={styles}
            currentView={currentView}
            sidebarCollapsed={sidebarCollapsed}
            logs={logs}
            showDebug={showDebug}
            t={t}
            onNavigate={(view) => {
              if (view === 'time') switchToTimeView()
              else if (view === 'games') switchToGames()
              else setCurrentView(view)
            }}
            onToggleSidebar={toggleSidebar}
          />

          <main style={styles.main} ref={gridRef} onScroll={handleScroll}>
          {notification && (
            <div style={styles.notification}>
              {notification.title}: {notification.body}
            </div>
          )}

          {isLoading ? (
            <div style={styles.loading}>加载中...</div>
          ) : currentView === 'time' ? (
            <ScreenshotGrid
              theme={theme}
              styles={styles}
              t={t}
              screenshots={screenshots}
              isMultiSelectMode={isMultiSelectMode}
              selectedScreenshots={selectedScreenshots}
              sortOrder={sortOrder}
              iconSize={iconSize}
              currentPage={currentPage}
              totalPages={totalPages}
              isLoadingMore={isLoadingMore}
              onSortChange={handleSortChange}
              onIconSizeChange={handleIconSizeChange}
              onToggleMultiSelect={setIsMultiSelectMode}
              onSelectScreenshot={(action) => {
                if (action === 'delete') deleteSelectedScreenshots()
              }}
              onToggleSelect={(id, index) => {
                if (isMultiSelectMode) {
                  toggleSelectScreenshot(id)
                } else {
                  setSelectedScreenshot(screenshots[index])
                  setSelectedScreenshotIndex(index)
                  setNoteText(screenshots[index].note || '')
                }
              }}
              onLoadPage={(page) => loadScreenshotsWithPagination(page, null)}
            />
          ) : currentView === 'games' ? (
            <GameList
              theme={theme}
              styles={styles}
              t={t}
              games={games}
              isGameMultiSelectMode={isGameMultiSelectMode}
              selectedGames={selectedGames}
              gameSortOrder={gameSortOrder}
              iconSize={iconSize}
              showMenu={showGameListMenu}
              onSortChange={handleGameSortChange}
              onIconSizeChange={handleIconSizeChange}
              onToggleMultiSelect={setIsGameMultiSelectMode}
              onSelectGame={(action) => {
                if (action === 'delete' && selectedGames.length > 0) {
                  setDeleteConfirmMode('delete_game')
                  setShowDeleteGameConfirm(true)
                  setDeleteGameCallback(() => async (confirm) => {
                    if (confirm) {
                      try {
                        for (const gameId of selectedGames) {
                          await invoke('delete_game', { gameId })
                          addLog(`已删除游戏: ${gameId}`)
                        }
                        showNotification('删除成功', `已删除 ${selectedGames.length} 个游戏`)
                      } catch (e) {
                        addLog(`删除游戏失败: ${e}`)
                        setError('删除游戏失败: ' + String(e))
                      }
                    }
                    setShowDeleteGameConfirm(false)
                    setDeleteGameCallback(null)
                    setIsGameMultiSelectMode(false)
                    setSelectedGames([])
                    await loadGames()
                  })
                }
              }}
              onToggleSelectGame={(game) => {
                if (isGameMultiSelectMode) {
                  setSelectedGames(prev => 
                    prev.includes(game.game_id) 
                      ? prev.filter(id => id !== game.game_id)
                      : [...prev, game.game_id]
                  )
                } else {
                  selectGame(game)
                }
              }}
              onAddGame={() => {
                setShowAddGameModal(true)
                setAddGameStep('platform')
                setAddGameSearchTerm('')
                setAddGameSearchResults([])
              }}
              onToggleMenu={(show) => {
                console.log('[DEBUG] GameList onToggleMenu:', show)
                setShowGameListMenu(show)
              }}
            />
          ) : currentView === 'game-detail' ? (
            <GameDetail
              theme={theme}
              styles={styles}
              t={t}
              selectedGame={selectedGame}
              screenshots={screenshots}
              isMultiSelectMode={isMultiSelectMode}
              selectedScreenshots={selectedScreenshots}
              sortOrder={sortOrder}
              iconSize={iconSize}
              showMenu={showGameDetailMenu}
              showSortMenu={showSortMenu}
              onBack={backToGames}
              onSortChange={handleSortChange}
              onIconSizeChange={handleIconSizeChange}
              onToggleMultiSelect={setIsMultiSelectMode}
              onSelectScreenshot={(action) => {
                if (action === 'delete') deleteSelectedScreenshots()
              }}
              onToggleSelect={(id, index) => {
                if (isMultiSelectMode) {
                  toggleSelectScreenshot(id)
                } else {
                  setSelectedScreenshot(screenshots[index])
                  setSelectedScreenshotIndex(index)
                  setNoteText(screenshots[index].note || '')
                }
              }}
              onOpenSearch={() => {
                setShowSearchModal(true)
                setSearchModalStep('source')
                setSteamSearchTerm('')
                setSteamSearchResults([])
              }}
              onOpenImport={() => {
                setShowImportModal(true)
                setImportFiles([])
              }}
              onToggleMenu={(show) => {
                console.log('[DEBUG] GameDetail onToggleMenu:', show)
                setShowGameDetailMenu(show)
              }}
              onToggleSortMenu={setShowSortMenu}
            />
          ) : (
            <SettingsPanel
              theme={theme}
              styles={styles}
              t={t}
              themes={themes}
              language={language}
              steamLanguage={steamLanguage}
              currentTheme={currentTheme}
              storagePath={storagePath}
              isMigrating={isMigrating}
              migrationProgress={migrationProgress}
              migrationTotal={migrationTotal}
              migrationStatus={migrationStatus}
              autostart={autostart}
              shutterSound={shutterSound}
              screenshotFormat={screenshotFormat}
              screenshotQuality={screenshotQuality}
              bangumiAccessToken={bangumiAccessToken}
              bangumiCookie={bangumiCookie}
              onLanguageChange={setLanguage}
              onSteamLanguageChange={setSteamLanguage}
              onThemeChange={setCurrentTheme}
              onChangeStoragePath={changeStoragePath}
              onImportDirectory={importExistingDirectory}
              onAutostartChange={saveAutostart}
              onShutterSoundChange={saveShutterSound}
              onPlaySoundPreview={playSoundPreview}
              onScreenshotFormatChange={saveScreenshotFormat}
              onScreenshotQualityChange={saveScreenshotQuality}
              onBangumiAuthChange={handleBangumiAuthChange}
              onDeleteAll={() => setShowDeleteConfirm(true)}
            />
          )}
        </main>
        </div>

        <ScreenshotModal
          theme={theme}
          styles={styles}
          t={t}
          selectedScreenshot={selectedScreenshot}
          selectedScreenshotIndex={selectedScreenshotIndex}
          screenshots={screenshots}
          noteText={noteText}
          isModalClosing={isModalClosing}
          onClose={closeModal}
          onNavigate={navigateScreenshot}
          onNoteChange={setNoteText}
          onSaveNote={saveNote}
          onOpenFolder={openInExplorer}
          onDelete={deleteScreenshot}
          onShare={(screenshot) => {
            setShareScreenshot(screenshot)
            setShowShareModal(true)
          }}
        />

        {showShareModal && (
          <ShareModal
            theme={theme}
            styles={styles}
            t={t}
            screenshot={shareScreenshot}
            gameInfo={selectedGame}
            onClose={() => {
              setShowShareModal(false)
              setShareScreenshot(null)
            }}
            username={shareUsername}
            onUsernameChange={(name) => {
              setShareUsername(name)
              localStorage.setItem('shareUsername', name)
            }}
            onExport={async (dataUrl, format) => {
              try {
                const { save } = await import('@tauri-apps/plugin-dialog')
                const filePath = await save({
                  defaultPath: `share_${Date.now()}.${format}`,
                  filters: [{
                    name: format.toUpperCase(),
                    extensions: [format]
                  }]
                })
                if (filePath) {
                  await invoke('save_share_image', {
                    imagePath: filePath,
                    imageData: dataUrl.split(',')[1],
                    format: format
                  })
                  showNotification(t.share.save_success)
                }
              } catch (err) {
                addLog(`导出分享图片失败: ${err}`)
                showNotification(t.share.save_failed)
              }
            }}
          />
        )}

        <AddGameModal
          theme={theme}
          styles={styles}
          t={t}
          steamLanguage={steamLanguage}
          show={showAddGameModal}
          step={addGameStep}
          searchTerm={addGameSearchTerm}
          searchResults={addGameSearchResults}
          isAdding={isAddingGame}
          source={addGameSource}
          onClose={() => setShowAddGameModal(false)}
          onStepChange={setAddGameStep}
          onSearchTermChange={setAddGameSearchTerm}
          onAddGame={handleAddGame}
        />

        {showSearchModal && (
          <div style={styles.modalOverlay} onClick={() => setShowSearchModal(false)}>
            <div style={{ ...styles.modalContent, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              {searchModalStep === 'source' && (
                <div style={{ padding: 24 }}>
                  <h2 style={{ marginBottom: 24, textAlign: 'center' }}>{t.search.select_source}</h2>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                      style={{ 
                        ...styles.btn, 
                        padding: '16px 24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 12,
                        fontSize: 16
                      }}
                      {...btnEvents}
                      onClick={() => {
                        setSearchSource('steam')
                        setSearchModalStep('search')
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                      </svg>
                      {t.add_game.steam}
                    </button>
                    <button
                      style={{ 
                        ...styles.btn, 
                        padding: '16px 24px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        gap: 12,
                        fontSize: 16
                      }}
                      {...btnEvents}
                      onClick={() => {
                        setSearchSource('bangumi')
                        setSearchModalStep('search')
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
                        <line x1="9" y1="9" x2="9.01" y2="9"/>
                        <line x1="15" y1="9" x2="15.01" y2="9"/>
                      </svg>
                      {t.add_game.bangumi}
                    </button>
                  </div>
                </div>
              )}
              
              {searchModalStep === 'search' && (
                <div style={{ padding: 24 }}>
                  <h2 style={{ marginBottom: 16, textAlign: 'center' }}>
                    {searchSource === 'steam' ? t.search.title : '搜索 Bangumi 游戏'}
                  </h2>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <input
                      type="text"
                      value={steamSearchTerm}
                      onChange={(e) => setSteamSearchTerm(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && steamSearchTerm.trim()) {
                          setIsSearching(true)
                          try {
                            let results = []
                            if (searchSource === 'steam') {
                              results = await invoke('search_steam_games', { searchTerm: steamSearchTerm, language: steamLanguage })
                              setSteamSearchResults(results)
                            } else {
                              results = await invoke('search_bangumi_games', { searchTerm: steamSearchTerm })
                              setSteamSearchResults(results.map(r => ({
                                appid: r.id,
                                name: language === 'zh' ? (r.name_cn || r.name) : r.name,
                                tiny_image: r.image
                              })))
                            }
                            if (results.length > 0) {
                              setSearchModalStep('results')
                            }
                          } catch (err) {
                            addLog(`${searchSource === 'steam' ? 'Steam' : 'Bangumi'}搜索失败: ${err}`)
                          }
                          setIsSearching(false)
                        }
                      }}
                      placeholder={searchSource === 'steam' ? t.search.placeholder : '输入游戏名称搜索...'}
                      style={{ ...styles.input, flex: 1 }}
                      autoFocus
                    />
                    <button 
                      style={styles.btnPrimary}
                      {...btnEvents}
                      onClick={async () => {
                        if (!steamSearchTerm.trim()) return
                        setIsSearching(true)
                        try {
                          let results = []
                          if (searchSource === 'steam') {
                            results = await invoke('search_steam_games', { searchTerm: steamSearchTerm, language: steamLanguage })
                            setSteamSearchResults(results)
                          } else {
                            results = await invoke('search_bangumi_games', { searchTerm: steamSearchTerm })
                            setSteamSearchResults(results.map(r => ({
                              appid: r.id,
                              name: language === 'zh' ? (r.name_cn || r.name) : r.name,
                              tiny_image: r.image
                            })))
                          }
                          if (results.length > 0) {
                            setSearchModalStep('results')
                          }
                        } catch (err) {
                          addLog(`${searchSource === 'steam' ? 'Steam' : 'Bangumi'}搜索失败: ${err}`)
                        }
                        setIsSearching(false)
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
                            onClick={async () => {
                              if (!selectedGame) return
                              setIsApplyingInfo(true)
                              try {
                                let updatedGame
                                if (searchSource === 'steam') {
                                  updatedGame = await invoke('update_game_steam_info', {
                                    gameId: selectedGame.game_id,
                                    appid: result.appid,
                                    gameName: result.name,
                                    language: steamLanguage
                                  })
                                  addLog(`更新游戏信息成功: ${result.name}`)
                                } else {
                                  updatedGame = await invoke('apply_bangumi_game_info', {
                                    gameId: selectedGame.game_id,
                                    subjectId: result.appid,
                                    language: language
                                  })
                                  addLog(`更新游戏信息成功: ${result.name}`)
                                }
                                setAppliedGameName(result.name)
                                setShowApplySuccess(true)
                                setTimeout(() => setShowApplySuccess(false), 2000)
                                setShowSearchModal(false)
                                setSearchModalStep('source')
                                setSteamSearchTerm('')
                                setSteamSearchResults([])
                                setSelectedGame(updatedGame)
                                setCurrentView('game-detail')
                                await loadGames()
                                await loadScreenshotsWithPagination(1, updatedGame.game_id)
                              } catch (err) {
                                addLog(`更新游戏信息失败: ${err}`)
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
                              <div style={{ fontWeight: 'bold', color: theme.text }}>{result.name}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button 
                        style={{ ...styles.btn, width: '100%', marginTop: 16 }}
                        {...btnEvents}
                        onClick={() => setSearchModalStep('search')}
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

        <ImportModal
          theme={theme}
          styles={styles}
          t={t}
          show={showImportModal}
          files={importFiles}
          isImporting={isImporting}
          selectedGame={selectedGame}
          onClose={() => setShowImportModal(false)}
          onFilesChange={setImportFiles}
          onImport={handleImport}
        />

        {importProgress && (
          <div style={styles.modalOverlay}>
            <div style={{ ...styles.modalContent, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ 
                  width: 48, 
                  height: 48, 
                  border: `3px solid ${theme.border}`,
                  borderTop: `3px solid ${theme.primary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <h3 style={{ marginBottom: 16, color: theme.text }}>{t.import.importing}</h3>
                <div style={{ 
                  background: theme.accent, 
                  borderRadius: 8, 
                  padding: '12px 16px', 
                  marginBottom: 16 
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    marginBottom: 8,
                    fontSize: 14,
                    color: theme.text
                  }}>
                    <span>{importProgress.current} / {importProgress.total}</span>
                    <span>{Math.round(importProgress.current / importProgress.total * 100)}%</span>
                  </div>
                  <div style={{ 
                    background: theme.border, 
                    borderRadius: 4, 
                    height: 8, 
                    overflow: 'hidden' 
                  }}>
                    <div style={{ 
                      background: theme.primary, 
                      height: '100%', 
                      width: `${importProgress.current / importProgress.total * 100}%`,
                      transition: 'width 0.3s'
                    }} />
                  </div>
                </div>
                {importProgress.current_file && (
                  <p style={{ color: theme.textMuted, fontSize: 13, wordBreak: 'break-all' }}>
                    {importProgress.current_file}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {importResult && (
          <div style={styles.modalOverlay} onClick={() => setImportResult(null)}>
            <div style={{ ...styles.modalContent, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  borderRadius: '50%', 
                  background: 'rgba(74, 222, 128, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <h3 style={{ marginBottom: 16, color: theme.text }}>{t.import.import_complete || '导入完成'}</h3>
                <div style={{ 
                  background: theme.accent, 
                  borderRadius: 8, 
                  padding: 16, 
                  marginBottom: 16,
                  textAlign: 'left'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: theme.textMuted }}>{t.import.imported || '成功导入'}:</span>
                    <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{importResult.imported_count}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: theme.textMuted }}>{t.import.skipped || '跳过重复'}:</span>
                    <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{importResult.skipped_count}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ color: theme.textMuted }}>{t.import.failed || '导入失败'}:</span>
                    <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{importResult.failed_count}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: theme.textMuted }}>{t.import.duration || '耗时'}:</span>
                    <span style={{ color: theme.text }}>{importResult.duration_ms}ms</span>
                  </div>
                </div>
                <button 
                  style={{ ...styles.btnPrimary, padding: '12px 32px' }}
                  {...btnEvents}
                  onClick={() => setImportResult(null)}
                >
                  {t.import.confirm || '确定'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div style={styles.modalOverlay} onClick={() => setShowDeleteConfirm(false)}>
            <div style={{ ...styles.modalContent, maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div style={{ 
                  width: 64, 
                  height: 64, 
                  borderRadius: '50%', 
                  background: 'rgba(239, 68, 68, 0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 20px'
                }}>
                  <span style={{ fontSize: 32 }}>⚠️</span>
                </div>
                <h3 style={{ marginBottom: 16, color: theme.text }}>{t.settings.delete_all}</h3>
                <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>
                  {t.settings.delete_all_confirm}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button 
                    style={{ ...styles.btn, padding: '12px 24px' }}
                    {...btnEvents}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    {t.settings.cancel || '取消'}
                  </button>
                  <button 
                    style={{ ...styles.btnDanger, padding: '12px 24px' }}
                    {...btnEvents}
                    onClick={async () => {
                      try {
                        await invoke('delete_all_data')
                        addLog('所有数据已删除')
                        setShowDeleteConfirm(false)
                        showNotification(t.settings.restart_required || '需要重启程序', '程序将自动重启')
                        setTimeout(async () => {
                          try {
                            await invoke('restart_app')
                          } catch (e) {
                            addLog(`重启失败: ${e}`)
                          }
                        }, 500)
                      } catch (e) {
                        addLog(`删除所有数据失败: ${e}`)
                        setError(`删除失败: ${e}`)
                      }
                    }}
                  >
                    {t.settings.delete_all}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showDeleteGameConfirm && (
          <div style={styles.modalOverlay} onClick={() => {
            setShowDeleteGameConfirm(false)
            if (deleteGameCallback) {
              setDeleteGameCallback(null)
            }
          }}>
            <div style={{ ...styles.modalContent, maxWidth: 450 }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: 32, textAlign: 'center' }}>
                <h3 style={{ marginBottom: 16, color: theme.text }}>
                  {deleteConfirmMode === 'delete_game' ? t.delete_game_confirm.title : t.delete_last_screenshot.title}
                </h3>
                <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 24 }}>
                  {deleteConfirmMode === 'delete_game' ? t.delete_game_confirm.message : t.delete_last_screenshot.message}
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <button 
                    style={{ ...styles.btnDanger, padding: '12px 24px' }}
                    {...btnEvents}
                    onClick={() => deleteGameCallback && deleteGameCallback(true)}
                  >
                    {deleteConfirmMode === 'delete_game' ? t.delete_game_confirm.confirm : t.delete_last_screenshot.delete_game}
                  </button>
                  <button 
                    style={{ ...styles.btnPrimary, padding: '12px 24px' }}
                    {...btnEvents}
                    onClick={() => deleteGameCallback && deleteGameCallback(false)}
                  >
                    {deleteConfirmMode === 'delete_game' ? t.delete_game_confirm.cancel : t.delete_last_screenshot.keep_game}
                  </button>
                </div>
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

        {showApplySuccess && (
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
              <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{t.search.apply_success}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{appliedGameName}</div>
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
                    <h2 style={{ color: currentTheme === 'night' ? '#fff' : '#333', margin: 0, fontSize: 24 }}>欢迎使用 PuddingSnap</h2>
                  </div>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666', textAlign: 'center', marginBottom: 24 }}>
                    一个简单高效的截图管理工具，帮助你整理和浏览游戏截图
                  </p>
                </>
              )}
              
              {guideStep === 1 && (
                <>
                  <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16 }}>📸 快捷截图</h3>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666', marginBottom: 16 }}>
                    按 <strong>PrintScreen</strong> 键即可截图，程序会自动识别当前运行的游戏
                  </p>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666' }}>
                    截图会自动保存并分类到对应的游戏文件夹
                  </p>
                </>
              )}
              
              {guideStep === 2 && (
                <>
                  <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16 }}>🎮 游戏识别</h3>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666', marginBottom: 16 }}>
                    程序会自动识别你正在玩的游戏，并从 Steam 获取游戏信息
                  </p>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666' }}>
                    你也可以手动搜索和添加游戏信息
                  </p>
                </>
              )}
              
              {guideStep === 3 && (
                <>
                  <h3 style={{ color: currentTheme === 'night' ? '#fff' : '#333', marginBottom: 16 }}>📁 数据管理</h3>
                  <p style={{ color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666', marginBottom: 16 }}>
                    所有截图和数据库都保存在本地，你可以随时迁移到其他位置
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <input
                      type="checkbox"
                      id="dontShowAgain"
                      checked={dontShowAgain}
                      onChange={(e) => setDontShowAgain(e.target.checked)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <label htmlFor="dontShowAgain" style={{ 
                      color: currentTheme === 'night' ? 'rgba(255,255,255,0.7)' : '#666',
                      cursor: 'pointer',
                      fontSize: 14
                    }}>
                      不再显示此向导
                    </label>
                  </div>
                </>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
                {guideStep > 0 && (
                  <button
                    onClick={() => setGuideStep(guideStep - 1)}
                    style={{
                      padding: '10px 24px',
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
                      transition: 'all 0.2s',
                      marginLeft: 'auto'
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
                      transition: 'all 0.2s',
                      marginLeft: 'auto'
                    }}
                  >
                    开始使用
                  </button>
                )}
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

        {showCloseConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              background: theme.card,
              padding: 24,
              borderRadius: 12,
              width: 360,
              maxWidth: '90vw',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: theme.text, fontSize: 18, fontWeight: 600 }}>
                {t.close_confirm?.title || '关闭确认'}
              </h4>
              <p style={{ margin: '0 0 20px 0', color: theme.textMuted, fontSize: 14, lineHeight: 1.5 }}>
                {t.close_confirm?.message || '您想要关闭程序还是最小化到系统托盘？'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                <input
                  type="checkbox"
                  id="rememberCloseAction"
                  onChange={(e) => {
                    if (e.target.checked) {
                      localStorage.setItem('closeAction', 'ask')
                    } else {
                      localStorage.removeItem('closeAction')
                    }
                  }}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                <label htmlFor="rememberCloseAction" style={{ 
                  color: theme.textMuted,
                  cursor: 'pointer',
                  fontSize: 13
                }}>
                  {t.close_confirm?.remember || '记住我的选择'}
                </label>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    background: theme.accent,
                    color: theme.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => {
                    setShowCloseConfirm(false)
                    invoke('minimize_to_tray')
                  }}
                >
                  {t.close_confirm?.minimize || '最小化到托盘'}
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: 'none',
                    background: theme.danger,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => {
                    setShowCloseConfirm(false)
                    invoke('close_app')
                  }}
                >
                  {t.close_confirm?.close || '关闭程序'}
                </button>
              </div>
            </div>
          </div>
        )}

        {showScreenshotDeleteConfirm && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000
          }}>
            <div style={{
              background: theme.card,
              padding: 24,
              borderRadius: 12,
              width: 360,
              maxWidth: '90vw',
              boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
            }}>
              <div style={{ 
                width: 56, 
                height: 56, 
                borderRadius: '50%', 
                background: 'rgba(239, 68, 68, 0.1)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}>
                <span style={{ fontSize: 28 }}>🗑️</span>
              </div>
              <h4 style={{ margin: '0 0 12px 0', color: theme.text, fontSize: 18, fontWeight: 600, textAlign: 'center' }}>
                {t.detail?.confirm_delete || '确定删除'}
              </h4>
              <p style={{ margin: '0 0 20px 0', color: theme.textMuted, fontSize: 14, lineHeight: 1.5, textAlign: 'center' }}>
                {multiDeleteCount > 0 
                  ? `确定要删除 ${multiDeleteCount} 张截图吗？此操作不可撤销。`
                  : (t.detail?.confirm_delete_message || '确定要删除这张截图吗？此操作不可撤销。')
                }
              </p>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: `1px solid ${theme.border}`,
                    background: theme.accent,
                    color: theme.text,
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onClick={() => {
                    setShowScreenshotDeleteConfirm(false)
                    setScreenshotToDelete(null)
                    setMultiDeleteCount(0)
                  }}
                >
                  {t.common?.cancel || '取消'}
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: 'none',
                    background: theme.danger,
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s'
                  }}
                  onClick={async () => {
                    setShowScreenshotDeleteConfirm(false)
                    if (multiDeleteCount > 0) {
                      await doDeleteSelectedScreenshots()
                    } else if (screenshotToDelete) {
                      await doDeleteScreenshot(screenshotToDelete)
                    }
                    setScreenshotToDelete(null)
                    setMultiDeleteCount(0)
                  }}
                >
                  {t.common?.confirm || '确定'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default App
