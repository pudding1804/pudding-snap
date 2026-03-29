import { useState, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

function App() {
  const [currentView, setCurrentView] = useState('time')
  const [screenshots, setScreenshots] = useState([])
  const [games, setGames] = useState([])
  const [selectedGame, setSelectedGame] = useState(null)
  const [selectedScreenshot, setSelectedScreenshot] = useState(null)
  const [sortOrder, setSortOrder] = useState('desc')

  useEffect(() => {
    loadScreenshots()
    loadGames()
    
    const unsubscribe = listen('screenshot-taken', () => {
      loadScreenshots()
      loadGames()
    })

    return () => unsubscribe?.()
  }, [])

  const loadScreenshots = async (gameTitle = null) => {
    try {
      const data = await invoke('get_screenshots', { gameTitle, sortOrder })
      setScreenshots(data)
    } catch (e) {
      console.error('Failed to load screenshots:', e)
    }
  }

  const loadGames = async () => {
    try {
      const data = await invoke('get_games')
      setGames(data)
    } catch (e) {
      console.error('Failed to load games:', e)
    }
  }

  const deleteScreenshot = async (id) => {
    if (confirm('确定要删除这张截图吗？')) {
      try {
        await invoke('delete_screenshot', { id })
        setSelectedScreenshot(null)
        loadScreenshots(selectedGame?.game_title || null)
        loadGames()
      } catch (e) {
        console.error('Failed to delete screenshot:', e)
      }
    }
  }

  const saveNote = async (id, note) => {
    try {
      await invoke('update_note', { id, note })
      loadScreenshots(selectedGame?.game_title || null)
    } catch (e) {
      console.error('Failed to save note:', e)
    }
  }

  const formatDate = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleString('zh-CN')
  }

  const formatYearMonth = (timestamp) => {
    const date = new Date(timestamp * 1000)
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`
  }

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <nav className="w-64 bg-gray-800 p-4 flex flex-col">
        <h1 className="text-xl font-bold mb-8 text-center">📸 截图管理器</h1>
        <button
          onClick={() => { setCurrentView('time'); setSelectedGame(null); loadScreenshots() }}
          className={`p-3 mb-2 rounded ${currentView === 'time' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          ⏰ 按时间浏览
        </button>
        <button
          onClick={() => { setCurrentView('game'); setSelectedGame(null) }}
          className={`p-3 mb-2 rounded ${currentView === 'game' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          🎮 按游戏浏览
        </button>
        <button
          onClick={() => setCurrentView('settings')}
          className={`p-3 mb-2 rounded ${currentView === 'settings' ? 'bg-blue-600' : 'hover:bg-gray-700'}`}
        >
          ⚙️ 设置
        </button>
      </nav>

      <main className="flex-1 p-6 overflow-auto">
        {currentView === 'time' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">按时间浏览</h2>
              <button
                onClick={() => {
                  setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                  loadScreenshots()
                }}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                {sortOrder === 'desc' ? '▼ 从新到旧' : '▲ 从旧到新'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {screenshots.map((ss, idx) => (
                <div key={idx}>
                  {(idx === 0 || formatYearMonth(ss.timestamp) !== formatYearMonth(screenshots[idx - 1].timestamp)) && (
                    <div className="col-span-3 text-gray-400 text-lg font-semibold my-4 sticky top-0 bg-gray-900 py-2">
                      {formatYearMonth(ss.timestamp)}
                    </div>
                  )}
                  <div
                    onClick={() => setSelectedScreenshot(ss)}
                    className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500"
                  >
                    <div className="aspect-video bg-gray-700 flex items-center justify-center">
                      <img src={`asset://${ss.file_path}`} alt="Screenshot" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-gray-400">{formatDate(ss.timestamp)}</p>
                      <p className="font-medium truncate">{ss.display_title || ss.game_title}</p>
                      {ss.note && <p className="text-sm text-gray-400 truncate mt-1">{ss.note}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'game' && !selectedGame && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">按游戏浏览</h2>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {games.map((game, idx) => (
                <div
                  key={idx}
                  onClick={() => { setSelectedGame(game); loadScreenshots(game.game_title) }}
                  className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500"
                >
                  <div className="aspect-square bg-gray-700 flex items-center justify-center">
                    {game.game_banner_url ? (
                      <img src={game.game_banner_url} alt="Game" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl">🎮</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium truncate">{game.display_title || game.game_title}</p>
                    <p className="text-sm text-gray-400">{game.count} 张截图</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'game' && selectedGame && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setSelectedGame(null)}
                  className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
                >
                  ← 返回
                </button>
                <h2 className="text-2xl font-bold">{selectedGame.display_title || selectedGame.game_title}</h2>
              </div>
              <button
                onClick={() => {
                  setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                  loadScreenshots(selectedGame.game_title)
                }}
                className="px-4 py-2 bg-gray-700 rounded hover:bg-gray-600"
              >
                {sortOrder === 'desc' ? '▼ 从新到旧' : '▲ 从旧到新'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {screenshots.map((ss, idx) => (
                <div key={idx}>
                  {(idx === 0 || formatYearMonth(ss.timestamp) !== formatYearMonth(screenshots[idx - 1].timestamp)) && (
                    <div className="col-span-3 text-gray-400 text-lg font-semibold my-4 sticky top-0 bg-gray-900 py-2">
                      {formatYearMonth(ss.timestamp)}
                    </div>
                  )}
                  <div
                    onClick={() => setSelectedScreenshot(ss)}
                    className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500"
                  >
                    <div className="aspect-video bg-gray-700 flex items-center justify-center">
                      <img src={`asset://${ss.file_path}`} alt="Screenshot" className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <p className="text-sm text-gray-400">{formatDate(ss.timestamp)}</p>
                      {ss.note && <p className="text-sm text-gray-400 truncate mt-1">{ss.note}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === 'settings' && (
          <div>
            <h2 className="text-2xl font-bold mb-6">设置</h2>
            <div className="bg-gray-800 rounded-lg p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-3">通用</h3>
                <label className="flex items-center gap-3">
                  <input type="checkbox" className="w-5 h-5" />
                  <span>开机自启动</span>
                </label>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">画质</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block mb-1">压缩格式</label>
                    <select className="w-full p-2 bg-gray-700 rounded">
                      <option>WebP</option>
                      <option>PNG</option>
                      <option>JPG</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1">质量等级</label>
                    <input type="range" min="10" max="100" defaultValue="80" className="w-full" />
                  </div>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-3">个人</h3>
                <div>
                  <label className="block mb-1">玩家用户名</label>
                  <input type="text" placeholder="输入用户名" className="w-full p-2 bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {selectedScreenshot && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div className="max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex-1 flex items-center justify-center">
              <img
                src={`asset://${selectedScreenshot.file_path}`}
                alt="Screenshot"
                className="max-w-full max-h-full object-contain"
              />
            </div>
            <div className="bg-gray-800 p-4 rounded-t-lg">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium">{selectedScreenshot.display_title || selectedScreenshot.game_title}</p>
                  <p className="text-sm text-gray-400">{formatDate(selectedScreenshot.timestamp)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => deleteScreenshot(selectedScreenshot.id)}
                    className="px-4 py-2 bg-red-600 rounded hover:bg-red-500"
                  >
                    🗑️ 删除
                  </button>
                  <button
                    onClick={() => setSelectedScreenshot(null)}
                    className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500"
                  >
                    ✕ 关闭
                  </button>
                </div>
              </div>
              <div>
                <textarea
                  placeholder="添加最多120字的感悟..."
                  maxLength={120}
                  defaultValue={selectedScreenshot.note || ''}
                  onBlur={(e) => saveNote(selectedScreenshot.id, e.target.value)}
                  className="w-full p-2 bg-gray-700 rounded resize-none"
                  rows={2}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
