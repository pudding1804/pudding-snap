import { useCallback, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window'

const DEFAULT_WIDTH = 1200
const DEFAULT_HEIGHT = 800
const MIN_VALID_WIDTH = 400
const MIN_VALID_HEIGHT = 300
const MIN_VALID_POSITION = -10000

export function useWindowSize(addLog) {
  const isValidWindowState = (width, height, x, y) => {
    if (width < MIN_VALID_WIDTH || height < MIN_VALID_HEIGHT) {
      return false
    }
    if (x < MIN_VALID_POSITION || y < MIN_VALID_POSITION) {
      return false
    }
    return true
  }

  const loadWindowState = useCallback(async () => {
    try {
      addLog('[窗口] 开始加载窗口状态...')
      const savedWidth = await invoke('get_setting', { key: 'window_width' })
      const savedHeight = await invoke('get_setting', { key: 'window_height' })
      const savedX = await invoke('get_setting', { key: 'window_x' })
      const savedY = await invoke('get_setting', { key: 'window_y' })
      addLog(`[窗口] 读取到的值: size=${savedWidth}x${savedHeight}, pos=${savedX},${savedY}`)
      
      const appWindow = getCurrentWindow()
      const width = savedWidth ? parseInt(savedWidth) : DEFAULT_WIDTH
      const height = savedHeight ? parseInt(savedHeight) : DEFAULT_HEIGHT
      const x = savedX ? parseInt(savedX) : 100
      const y = savedY ? parseInt(savedY) : 100
      
      if (!isValidWindowState(width, height, x, y)) {
        addLog('[窗口] 检测到无效的窗口状态，使用默认值')
        await appWindow.setSize(new PhysicalSize(DEFAULT_WIDTH, DEFAULT_HEIGHT))
        await appWindow.setPosition(new PhysicalPosition(100, 100))
        addLog(`[窗口] 窗口已重置为默认状态: ${DEFAULT_WIDTH}x${DEFAULT_HEIGHT}, pos=100,100`)
        return
      }
      
      const currentSize = await appWindow.outerSize()
      const currentPos = await appWindow.outerPosition()
      addLog(`[窗口] 当前状态: size=${currentSize.width}x${currentSize.height}, pos=${currentPos.x},${currentPos.y}`)
      
      await appWindow.setSize(new PhysicalSize(width, height))
      await appWindow.setPosition(new PhysicalPosition(x, y))
      
      const newSize = await appWindow.outerSize()
      const newPos = await appWindow.outerPosition()
      addLog(`[窗口] 设置后状态: size=${newSize.width}x${newSize.height}, pos=${newPos.x},${newPos.y}`)
      addLog(`[窗口] 窗口状态已恢复`)
    } catch (e) {
      addLog(`[窗口] 恢复窗口状态失败: ${e}`)
    }
  }, [addLog])

  const saveWindowState = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow()
      const size = await appWindow.outerSize()
      const pos = await appWindow.outerPosition()
      
      if (!isValidWindowState(size.width, size.height, pos.x, pos.y)) {
        addLog(`[窗口] 检测到无效窗口状态，跳过保存: size=${size.width}x${size.height}, pos=${pos.x},${pos.y}`)
        return
      }
      
      addLog(`[窗口] 保存窗口状态: size=${size.width}x${size.height}, pos=${pos.x},${pos.y}`)
      await invoke('set_setting', { key: 'window_width', value: size.width.toString() })
      await invoke('set_setting', { key: 'window_height', value: size.height.toString() })
      await invoke('set_setting', { key: 'window_x', value: pos.x.toString() })
      await invoke('set_setting', { key: 'window_y', value: pos.y.toString() })
      addLog('[窗口] 窗口状态已保存到数据库')
    } catch (e) {
      addLog(`[窗口] 保存窗口状态失败: ${e}`)
    }
  }, [addLog])

  useEffect(() => {
    let saveTimeout = null
    
    const handleWindowChange = () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
      saveTimeout = setTimeout(() => {
        saveWindowState()
      }, 500)
    }
    
    const setupListeners = async () => {
      try {
        addLog('[窗口] 设置窗口状态监听器...')
        const appWindow = getCurrentWindow()
        const unlistenResize = await appWindow.onResized(handleWindowChange)
        const unlistenMove = await appWindow.onMoved(handleWindowChange)
        addLog('[窗口] 窗口状态监听器设置成功')
        return () => {
          unlistenResize()
          unlistenMove()
        }
      } catch (e) {
        addLog(`[窗口] 设置窗口状态监听失败: ${e}`)
        return () => {}
      }
    }
    
    let unlistenFn = null
    setupListeners().then(fn => {
      unlistenFn = fn
    })
    
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
      if (unlistenFn) {
        unlistenFn()
      }
    }
  }, [saveWindowState, addLog])

  return { loadWindowState, saveWindowState }
}
