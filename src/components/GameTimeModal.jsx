import { useState, useEffect, useCallback, useMemo } from 'react'
import { invoke } from '@tauri-apps/api/core'

const MONTH_LAYOUT = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]
]

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfWeek(year, month) {
  return new Date(year, month - 1, 1).getDay()
}

function getHeatColor(count, theme) {
  const primary = theme.primary
  const r = parseInt(primary.slice(1, 3), 16)
  const g = parseInt(primary.slice(3, 5), 16)
  const b = parseInt(primary.slice(5, 7), 16)

  const levels = [
    { threshold: 0, opacity: 0.05 },
    { threshold: 1, opacity: 0.15 },
    { threshold: 3, opacity: 0.3 },
    { threshold: 5, opacity: 0.5 },
    { threshold: 8, opacity: 0.7 },
    { threshold: 12, opacity: 0.9 }
  ]

  let opacity = 0.05
  for (const level of levels) {
    if (count >= level.threshold) {
      opacity = level.opacity
    }
  }

  const bg = theme.card
  const bgR = parseInt(bg.slice(1, 3), 16)
  const bgG = parseInt(bg.slice(3, 5), 16)
  const bgB = parseInt(bg.slice(5, 7), 16)

  const blendR = Math.round(bgR * (1 - opacity) + r * opacity)
  const blendG = Math.round(bgG * (1 - opacity) + g * opacity)
  const blendB = Math.round(bgB * (1 - opacity) + b * opacity)

  return `rgb(${blendR}, ${blendG}, ${blendB})`
}

function getLegendColors(theme) {
  return [
    { threshold: 0, label: '0' },
    { threshold: 1, label: '1-2' },
    { threshold: 3, label: '3-4' },
    { threshold: 5, label: '5-7' },
    { threshold: 8, label: '8-11' },
    { threshold: 12, label: '12+' }
  ].map(item => ({
    ...item,
    color: getHeatColor(item.threshold, theme)
  }))
}

function MonthGrid({ year, month, counts, theme, gt }) {
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const months = gt?.months || ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const weekdays = gt?.weekdays || ['日', '一', '二', '三', '四', '五', '六']

  const weeks = []
  let currentWeek = new Array(7).fill(null)
  let dayIndex = 1

  for (let i = firstDay; i < 7; i++) {
    currentWeek[i] = dayIndex++
  }
  weeks.push(currentWeek)

  while (dayIndex <= daysInMonth) {
    currentWeek = new Array(7).fill(null)
    for (let i = 0; i < 7; i++) {
      if (dayIndex > daysInMonth) break
      currentWeek[i] = dayIndex++
    }
    weeks.push(currentWeek)
  }

  const cellSize = 20

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
      minWidth: 0,
      flex: 1
    }}>
      <div style={{
        fontSize: 11,
        color: theme.textMuted,
        textAlign: 'center',
        marginBottom: 1,
        fontWeight: 500,
        lineHeight: '16px'
      }}>
        {months[month - 1]}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: 1,
        fontSize: 8
      }}>
        {weekdays.map(d => (
          <div key={d} style={{
            textAlign: 'center',
            color: theme.textMuted,
            fontSize: 8,
            lineHeight: '14px',
            height: 14
          }}>
            {d}
          </div>
        ))}
        {weeks.map((week, wi) =>
          week.map((day, di) => {
            if (day === null) {
              return <div key={`${wi}-${di}`} style={{ height: cellSize }} />
            }
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
            const count = counts[dateStr] || 0
            return (
              <div
                key={`${wi}-${di}`}
                title={`${dateStr}: ${count}`}
                style={{
                  height: cellSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 2,
                  background: getHeatColor(count, theme),
                  color: count >= 5 ? '#fff' : theme.textMuted,
                  fontSize: 8,
                  lineHeight: 1,
                  cursor: 'default'
                }}
              >
                {day}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export function GameTimeModal({ theme, styles, t, gameId, onClose }) {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [counts, setCounts] = useState(null)
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)

  const gt = t.game_time || {}

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const latestYear = await invoke('get_latest_screenshot_year', { gameId })
        if (!cancelled) {
          setYear(latestYear)
        }
      } catch (e) {
        console.error('获取最新截图年份失败:', e)
      }
      if (!cancelled) {
        setInitializing(false)
      }
    }
    init()
    return () => { cancelled = true }
  }, [gameId])

  const fetchCounts = useCallback(async (y) => {
    setLoading(true)
    try {
      const result = await invoke('get_screenshot_counts_by_date', {
        gameId,
        year: y
      })
      setCounts(result || {})
    } catch (e) {
      console.error('获取游戏时间数据失败:', e)
      setCounts({})
    }
    setLoading(false)
  }, [gameId])

  useEffect(() => {
    if (!initializing) {
      fetchCounts(year)
    }
  }, [year, initializing, fetchCounts])

  const totalScreenshots = useMemo(() => {
    return Object.values(counts || {}).reduce((sum, c) => sum + c, 0)
  }, [counts])

  const activeDays = useMemo(() => {
    return Object.values(counts || {}).filter(c => c > 0).length
  }, [counts])

  const legendColors = useMemo(() => getLegendColors(theme), [theme])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      style={{
        ...styles.modal,
        animation: 'modalFadeIn 0.2s ease'
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          ...styles.modalContent,
          width: 840,
          animation: 'modalFadeIn 0.2s ease'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{
          ...styles.modalHeader,
          justifyContent: 'center',
          position: 'relative',
          padding: '10px 16px'
        }}>
          <button
            onClick={() => setYear(y => y - 1)}
            style={{
              position: 'absolute',
              left: 16,
              background: 'none',
              border: 'none',
              color: theme.text,
              cursor: 'pointer',
              padding: '2px 8px',
              fontSize: 16,
              lineHeight: 1,
              borderRadius: 4,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = theme.accent}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ‹
          </button>

          <div style={{
            ...styles.modalTitle,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 16
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {year}
          </div>

          <button
            onClick={() => setYear(y => y + 1)}
            disabled={year >= currentYear + 1}
            style={{
              position: 'absolute',
              right: 16,
              background: 'none',
              border: 'none',
              color: year >= currentYear + 1 ? theme.textMuted : theme.text,
              cursor: year >= currentYear + 1 ? 'default' : 'pointer',
              padding: '2px 8px',
              fontSize: 16,
              lineHeight: 1,
              borderRadius: 4,
              transition: 'background 0.2s',
              opacity: year >= currentYear + 1 ? 0.4 : 1
            }}
            onMouseEnter={e => {
              if (year < currentYear + 1) e.currentTarget.style.background = theme.accent
            }}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ›
          </button>
        </div>

        <div style={{ padding: '8px 16px 10px' }}>
          {loading || initializing ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 360,
              color: theme.textMuted,
              fontSize: 14
            }}>
              {t.common?.loading || '加载中...'}
            </div>
          ) : totalScreenshots === 0 ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: 360,
              color: theme.textMuted,
              fontSize: 13
            }}>
              {gt.no_data || '暂无数据'}
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 20,
                marginBottom: 10,
                fontSize: 13,
                color: theme.textMuted
              }}>
                <span>{gt.screenshots_count?.replace('{count}', totalScreenshots) || `${totalScreenshots} 张截图`}</span>
                <span>{gt.active_days?.replace('{count}', activeDays) || `${activeDays} 天活跃`}</span>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6
              }}>
                {MONTH_LAYOUT.map((row, ri) => (
                  <div key={ri} style={{
                    display: 'flex',
                    gap: 6
                  }}>
                    {row.map(month => (
                      <MonthGrid
                        key={month}
                        year={year}
                        month={month}
                        counts={counts}
                        theme={theme}
                        gt={gt}
                      />
                    ))}
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                marginTop: 10,
                fontSize: 11,
                color: theme.textMuted
              }}>
                <span>{gt.legend_less || '少'}</span>
                {legendColors.map(item => (
                  <div
                    key={item.threshold}
                    title={`${item.label}`}
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 2,
                      background: item.color,
                      border: `1px solid ${theme.border}`
                    }}
                  />
                ))}
                <span>{gt.legend_more || '多'}</span>
              </div>
            </>
          )}
        </div>

        <div style={{
          padding: '8px 16px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'center'
        }}>
          <button
            onClick={onClose}
            style={{
              ...styles.btnPrimary,
              minWidth: 72,
              padding: '6px 20px',
              fontSize: 13
            }}
          >
            {gt.confirm || '确定'}
          </button>
        </div>
      </div>
    </div>
  )
}
