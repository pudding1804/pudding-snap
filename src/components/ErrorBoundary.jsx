import { Component } from 'react'

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ERROR BOUNDARY] Caught error:', error)
    console.error('[ERROR BOUNDARY] Error info:', errorInfo)
    this.setState({ errorInfo })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 20,
          background: '#1a1a2e',
          color: '#eee',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif'
        }}>
          <h1 style={{ color: '#ef4444', marginBottom: 16 }}>渲染错误</h1>
          <pre style={{
            background: '#16213e',
            padding: 16,
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 12,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {this.state.error?.toString()}
          </pre>
          <details style={{ marginTop: 16 }}>
            <summary style={{ cursor: 'pointer', color: '#4ade80' }}>组件堆栈</summary>
            <pre style={{
              background: '#16213e',
              padding: 16,
              borderRadius: 8,
              marginTop: 8,
              fontSize: 11,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}>
              {this.state.errorInfo?.componentStack}
            </pre>
          </details>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: '8px 16px',
              background: '#4ade80',
              border: 'none',
              borderRadius: 6,
              color: '#1a1a2e',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            刷新页面
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
