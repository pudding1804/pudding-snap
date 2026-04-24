import { useRef, useCallback } from 'react'

export function useNavigationHistory() {
  const backStackRef = useRef([])
  const forwardStackRef = useRef([])
  const isNavigatingRef = useRef(false)

  const pushHistory = useCallback((state) => {
    if (isNavigatingRef.current) {
      isNavigatingRef.current = false
      return
    }
    backStackRef.current.push(state)
    forwardStackRef.current = []
  }, [])

  const goBack = useCallback((currentState) => {
    if (backStackRef.current.length === 0) return null
    forwardStackRef.current.push(currentState)
    return backStackRef.current.pop()
  }, [])

  const goForward = useCallback((currentState) => {
    if (forwardStackRef.current.length === 0) return null
    backStackRef.current.push(currentState)
    return forwardStackRef.current.pop()
  }, [])

  const canGoBack = useCallback(() => backStackRef.current.length > 0, [])
  const canGoForward = useCallback(() => forwardStackRef.current.length > 0, [])

  const clear = useCallback(() => {
    backStackRef.current = []
    forwardStackRef.current = []
  }, [])

  return {
    pushHistory,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    clear,
    isNavigatingRef,
  }
}
