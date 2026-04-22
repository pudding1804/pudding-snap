import { useState, useRef, useEffect } from 'react'

export function Pagination({
  theme,
  currentPage = 1,
  totalPages = 1,
  onPageChange,
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handlePageClick = () => {
    setIsEditing(true)
    setInputValue(currentPage.toString())
  }

  const handleInputChange = (e) => {
    const value = e.target.value
    if (value === '' || /^\d+$/.test(value)) {
      setInputValue(value)
    }
  }

  const handleInputBlur = () => {
    setIsEditing(false)
    jumpToPage()
  }

  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setIsEditing(false)
      jumpToPage()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
    }
  }

  const jumpToPage = () => {
    if (inputValue === '') return
    let page = parseInt(inputValue, 10)
    if (isNaN(page)) return
    if (page < 1) page = 1
    else if (page > totalPages) page = totalPages
    if (page !== currentPage && onPageChange) {
      onPageChange(page)
    }
  }

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages

  const btnStyle = (disabled) => ({
    padding: '4px 10px',
    background: 'transparent',
    border: 'none',
    borderRadius: 4,
    color: disabled ? theme.textMuted : theme.text,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    fontSize: 13,
    transition: 'background 0.15s, opacity 0.15s',
  })

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      flexShrink: 0,
      padding: '10px 0',
    }}>
      <button
        style={btnStyle(isFirstPage)}
        onClick={() => !isFirstPage && onPageChange && onPageChange(1)}
        disabled={isFirstPage}
        onMouseEnter={(e) => { if (!isFirstPage) e.currentTarget.style.background = theme.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        首页
      </button>
      <button
        style={btnStyle(isFirstPage)}
        onClick={() => !isFirstPage && onPageChange && onPageChange(currentPage - 1)}
        disabled={isFirstPage}
        onMouseEnter={(e) => { if (!isFirstPage) e.currentTarget.style.background = theme.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        上一页
      </button>

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleInputKeyDown}
          style={{
            width: 50,
            padding: '3px 6px',
            textAlign: 'center',
            fontSize: 13,
            border: `1px solid ${theme.primary}`,
            borderRadius: 4,
            background: theme.accent,
            color: theme.text,
            outline: 'none',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 13,
            color: theme.textMuted,
            cursor: 'pointer',
            userSelect: 'none',
            padding: '3px 8px',
            borderRadius: 4,
            transition: 'background 0.15s',
          }}
          onClick={handlePageClick}
          onMouseEnter={(e) => { e.currentTarget.style.background = theme.accent }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          title="点击跳转"
        >
          {currentPage} / {totalPages}
        </span>
      )}

      <button
        style={btnStyle(isLastPage)}
        onClick={() => !isLastPage && onPageChange && onPageChange(currentPage + 1)}
        disabled={isLastPage}
        onMouseEnter={(e) => { if (!isLastPage) e.currentTarget.style.background = theme.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        下一页
      </button>
      <button
        style={btnStyle(isLastPage)}
        onClick={() => !isLastPage && onPageChange && onPageChange(totalPages)}
        disabled={isLastPage}
        onMouseEnter={(e) => { if (!isLastPage) e.currentTarget.style.background = theme.accent }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
      >
        末页
      </button>
    </div>
  )
}
