import { useState, useRef, useEffect } from 'react'
import { btnEvents } from '../styles/sharedStyles'

export function Pagination({
  theme,
  styles,
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
    if (inputValue === '') {
      return
    }
    
    let page = parseInt(inputValue, 10)
    
    if (isNaN(page)) {
      return
    }
    
    if (page < 1) {
      page = 1
    } else if (page > totalPages) {
      page = totalPages
    }
    
    if (page !== currentPage && onPageChange) {
      onPageChange(page)
    }
  }

  const isFirstPage = currentPage === 1
  const isLastPage = currentPage === totalPages

  const disabledBtnStyle = {
    ...styles.paginationBtn,
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none'
  }

  return (
    <div style={{ 
      ...styles.pagination, 
      flexShrink: 0,
      position: 'sticky',
      bottom: 0,
      background: theme.bg,
      zIndex: 10,
      marginTop: 0
    }}>
      <button 
        style={isFirstPage ? disabledBtnStyle : styles.paginationBtn}
        {...(isFirstPage ? {} : btnEvents)}
        onClick={() => onPageChange && onPageChange(1)}
        disabled={isFirstPage}
      >
        首页
      </button>
      <button 
        style={isFirstPage ? disabledBtnStyle : styles.paginationBtn}
        {...(isFirstPage ? {} : btnEvents)}
        onClick={() => onPageChange && onPageChange(currentPage - 1)}
        disabled={isFirstPage}
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
            width: 60,
            padding: '4px 8px',
            textAlign: 'center',
            fontSize: 14,
            border: `1px solid ${theme.primary}`,
            borderRadius: 4,
            background: theme.inputBg,
            color: '#333',
            outline: 'none'
          }}
        />
      ) : (
        <span 
          style={{ 
            ...styles.paginationInfo,
            cursor: 'pointer',
            userSelect: 'none'
          }}
          onClick={handlePageClick}
          title="点击跳转"
        >
          {currentPage}/{totalPages}页
        </span>
      )}
      
      <button 
        style={isLastPage ? disabledBtnStyle : styles.paginationBtn}
        {...(isLastPage ? {} : btnEvents)}
        onClick={() => onPageChange && onPageChange(currentPage + 1)}
        disabled={isLastPage}
      >
        下一页
      </button>
      <button 
        style={isLastPage ? disabledBtnStyle : styles.paginationBtn}
        {...(isLastPage ? {} : btnEvents)}
        onClick={() => onPageChange && onPageChange(totalPages)}
        disabled={isLastPage}
      >
        末页
      </button>
    </div>
  )
}
