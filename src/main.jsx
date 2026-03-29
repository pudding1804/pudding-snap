import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

console.log('[main.jsx] 脚本开始执行')

const rootElement = document.getElementById('root')
console.log('[main.jsx] root元素:', rootElement)

if (rootElement) {
  const root = ReactDOM.createRoot(rootElement)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
  console.log('[main.jsx] React 渲染完成')
} else {
  console.error('[main.jsx] 找不到 root 元素!')
  document.body.innerHTML = '<div style="color:red;padding:20px;">错误: 找不到 root 元素!</div>'
}
