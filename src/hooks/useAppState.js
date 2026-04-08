import { useState, useEffect, useRef, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export function useAppState() {
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
  
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState(0)
  const [dontShowAgain, setDontShowAgain] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedScreenshots, setSelectedScreenshots] = useState([])
  
  const [storagePath, setStoragePath] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState(0)
  const [migrationTotal, setMigrationTotal] = useState(0)
  const [migrationStatus, setMigrationStatus] = useState('')
  const [migrationStats, setMigrationStats] = useState(null)
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [captureMouse, setCaptureMouse] = useState(false)
  const [autostart, setAutostart] = useState(false)
  const [language, setLanguage] = useState('zh')
  const [steamLanguage, setSteamLanguage] = useState('schinese')
  
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchModalStep, setSearchModalStep] = useState('source')
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
  
  const [isGameMultiSelectMode, setIsGameMultiSelectMode] = useState(false)
  const [selectedGames, setSelectedGames] = useState([])
  
  const [showDeleteGameConfirm, setShowDeleteGameConfirm] = useState(false)
  const [deleteGameCallback, setDeleteGameCallback] = useState(null)
  
  const [showImportModal, setShowImportModal] = useState(false)
  const [importFiles, setImportFiles] = useState([])
  const [isImporting, setIsImporting] = useState(false)
  
  const [showMenu, setShowMenu] = useState(false)
  const [showSortMenu, setShowSortMenu] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })
  
  const refreshDebounceRef = useRef(null)
  const isRefreshingRef = useRef(false)
  const gridRef = useRef(null)

  const addLog = useCallback((msg) => {
    const time = new Date().toLocaleTimeString()
    console.log(`[${time}] ${msg}`)
    setLogs(prev => [...prev.slice(-20), `[${time}] ${msg}`])
  }, [])

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

  return {
    state: {
      currentView, setCurrentView,
      screenshots, setScreenshots,
      games, setGames,
      selectedGame, setSelectedGame,
      selectedScreenshot, setSelectedScreenshot,
      selectedScreenshotIndex, setSelectedScreenshotIndex,
      isModalClosing, setIsModalClosing,
      sortOrder, setSortOrder,
      gameSortOrder, setGameSortOrder,
      iconSize, setIconSize,
      isLoading, setIsLoading,
      notification, setNotification,
      error, setError,
      logs, setLogs,
      noteText, setNoteText,
      currentTheme, setCurrentTheme,
      showGuide, setShowGuide,
      guideStep, setGuideStep,
      dontShowAgain, setDontShowAgain,
      currentPage, setCurrentPage,
      totalPages, setTotalPages,
      pageSize, setPageSize,
      isLoadingMore, setIsLoadingMore,
      isMultiSelectMode, setIsMultiSelectMode,
      selectedScreenshots, setSelectedScreenshots,
      storagePath, setStoragePath,
      isMigrating, setIsMigrating,
      migrationProgress, setMigrationProgress,
      migrationTotal, setMigrationTotal,
      migrationStatus, setMigrationStatus,
      migrationStats, setMigrationStats,
      showDeleteConfirm, setShowDeleteConfirm,
      captureMouse, setCaptureMouse,
      autostart, setAutostart,
      language, setLanguage,
      steamLanguage, setSteamLanguage,
      showSearchModal, setShowSearchModal,
      searchModalStep, setSearchModalStep,
      steamSearchTerm, setSteamSearchTerm,
      steamSearchResults, setSteamSearchResults,
      isSearching, setIsSearching,
      isApplyingInfo, setIsApplyingInfo,
      showApplySuccess, setShowApplySuccess,
      appliedGameName, setAppliedGameName,
      screenshotNotification, setScreenshotNotification,
      showAddGameModal, setShowAddGameModal,
      addGameStep, setAddGameStep,
      addGameSearchTerm, setAddGameSearchTerm,
      addGameSearchResults, setAddGameSearchResults,
      isAddingGame, setIsAddingGame,
      isGameMultiSelectMode, setIsGameMultiSelectMode,
      selectedGames, setSelectedGames,
      showDeleteGameConfirm, setShowDeleteGameConfirm,
      deleteGameCallback, setDeleteGameCallback,
      showImportModal, setShowImportModal,
      importFiles, setImportFiles,
      isImporting, setIsImporting,
      showMenu, setShowMenu,
      showSortMenu, setShowSortMenu,
      sidebarCollapsed, setSidebarCollapsed,
    },
    refs: {
      refreshDebounceRef,
      isRefreshingRef,
      gridRef,
    },
    actions: {
      addLog,
      showScreenshotNotification,
      toggleSidebar,
      handleIconSizeChange,
    }
  }
}
