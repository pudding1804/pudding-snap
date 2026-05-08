import { jsPDF } from 'jspdf'
import { invoke } from '@tauri-apps/api/core'

const IMAGE_MIME = 'image/jpeg'

function formatTimestamp(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

function loadImageDimensions(base64Data) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 1920, height: 1080 })
    img.src = `data:${IMAGE_MIME};base64,${base64Data}`
  })
}

const LAYOUTS = {
  8: { cols: 2, rows: 4 },
  12: { cols: 3, rows: 4 },
  16: { cols: 4, rows: 4 }
}

let cachedFontBase64 = null
let fontLoadAttempted = false

async function loadCjkFont() {
  if (cachedFontBase64 !== null) return cachedFontBase64
  if (fontLoadAttempted) return cachedFontBase64
  fontLoadAttempted = true
  try {
    cachedFontBase64 = await invoke('get_cjk_font_base64')
  } catch {
    cachedFontBase64 = null
  }
  return cachedFontBase64
}

function splitTextToFit(doc, text, maxWidth) {
  const lines = []
  let remaining = text
  while (remaining.length > 0) {
    if (doc.getTextWidth(remaining) <= maxWidth) {
      lines.push(remaining)
      break
    }
    let lineEnd = remaining.length
    while (lineEnd > 1 && doc.getTextWidth(remaining.substring(0, lineEnd)) > maxWidth) {
      lineEnd--
    }
    if (lineEnd < 1) lineEnd = 1
    lines.push(remaining.substring(0, lineEnd))
    remaining = remaining.substring(lineEnd)
  }
  return lines
}

export async function generatePdfExport(screenshots, imagesBase64, gameInfo, t, imagesPerPage) {
  const bst = t.batch_share || {}
  const gameTitle = gameInfo?.display_title || gameInfo?.game_title || 'Game'
  const rating = gameInfo?.rating != null && gameInfo?.rating >= 0 ? gameInfo.rating : null
  const noNote = bst.no_note || 'No note'

  const cjkFontBase64 = await loadCjkFont()
  const hasCjkFont = !!cjkFontBase64
  const cjkFontName = 'CJKFont'

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  if (hasCjkFont) {
    doc.addFileToVFS(`${cjkFontName}.ttf`, cjkFontBase64)
    doc.addFont(`${cjkFontName}.ttf`, cjkFontName, 'normal')
  }

  const textFont = hasCjkFont ? cjkFontName : 'helvetica'
  const titleFont = hasCjkFont ? cjkFontName : 'helvetica'

  const layout = LAYOUTS[imagesPerPage] || LAYOUTS[8]
  const { cols, rows } = layout

  const pageWidth = 210
  const pageHeight = 297
  const margin = 15
  const contentWidth = pageWidth - margin * 2
  const contentHeight = pageHeight - margin * 2

  const titleAreaHeight = 18
  const cellGap = 5
  const metaLineHeight = 3.5
  const metaGap = 1
  const noteMaxLines = 2
  const metaAreaHeight = noteMaxLines * metaLineHeight + metaLineHeight + metaGap

  const cellWidth = (contentWidth - cellGap * (cols - 1)) / cols
  const firstPageImageAreaHeight = contentHeight - titleAreaHeight
  const normalPageImageAreaHeight = contentHeight

  const firstPageCellHeight = (firstPageImageAreaHeight - cellGap * (rows - 1)) / rows
  const normalPageCellHeight = (normalPageImageAreaHeight - cellGap * (rows - 1)) / rows

  doc.setDrawColor(200, 200, 210)
  doc.setLineWidth(0.3)
  doc.line(margin, margin + titleAreaHeight, margin + contentWidth, margin + titleAreaHeight)

  doc.setFont(titleFont, 'normal')
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 50)
  doc.text(gameTitle, margin, margin + 8)

  if (rating !== null) {
    const ratingStr = `  ★ ${rating}/10`
    const titleWidth = doc.getTextWidth(gameTitle)
    doc.setFontSize(10)
    doc.setTextColor(180, 150, 50)
    doc.text(ratingStr, margin + titleWidth, margin + 8)
  }

  doc.setFont(textFont, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(140, 140, 160)
  doc.text(`${screenshots.length} screenshots`, margin, margin + 14)

  let currentRow = 0
  let currentCol = 0
  let isFirstPage = true

  for (let i = 0; i < screenshots.length; i++) {
    const ss = screenshots[i]
    const b64 = imagesBase64[i] || ''

    const cellHeight = isFirstPage ? firstPageCellHeight : normalPageCellHeight
    const imageHeight = cellHeight - metaAreaHeight
    const startY = isFirstPage
      ? margin + titleAreaHeight + currentRow * (cellHeight + cellGap)
      : margin + currentRow * (cellHeight + cellGap)
    const startX = margin + currentCol * (cellWidth + cellGap)

    if (b64) {
      const dims = await loadImageDimensions(b64)
      const aspectRatio = dims.width / dims.height
      const cellAspect = cellWidth / imageHeight

      let drawWidth, drawHeight, offsetX, offsetY
      if (aspectRatio > cellAspect) {
        drawWidth = cellWidth
        drawHeight = cellWidth / aspectRatio
        offsetX = 0
        offsetY = (imageHeight - drawHeight) / 2
      } else {
        drawHeight = imageHeight
        drawWidth = imageHeight * aspectRatio
        offsetX = (cellWidth - drawWidth) / 2
        offsetY = 0
      }

      doc.setFillColor(245, 245, 250)
      doc.rect(startX, startY, cellWidth, imageHeight, 'F')

      try {
        doc.addImage(
          `data:${IMAGE_MIME};base64,${b64}`,
          'JPEG',
          startX + offsetX,
          startY + offsetY,
          drawWidth,
          drawHeight,
          undefined,
          'FAST'
        )
      } catch {
        // skip failed image
      }
    }

    const metaY = startY + imageHeight + metaGap
    const noteText = ss.note || noNote
    const timeStr = formatTimestamp(ss.timestamp)
    const textMaxWidth = cellWidth - 4

    doc.setFont(textFont, 'normal')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 100)

    const noteLines = splitTextToFit(doc, noteText, textMaxWidth)
    const displayNoteLines = noteLines.slice(0, noteMaxLines)
    displayNoteLines.forEach((line, li) => {
      doc.text(line, startX + 2, metaY + (li + 1) * metaLineHeight)
    })

    doc.setFontSize(6)
    doc.setTextColor(140, 140, 160)
    doc.text(timeStr, startX + 2, metaY + noteMaxLines * metaLineHeight + metaLineHeight)

    currentCol++
    if (currentCol >= cols) {
      currentCol = 0
      currentRow++
    }

    const maxRows = isFirstPage
      ? Math.floor((firstPageImageAreaHeight + cellGap) / (cellHeight + cellGap))
      : Math.floor((normalPageImageAreaHeight + cellGap) / (cellHeight + cellGap))

    if (currentRow >= maxRows && i < screenshots.length - 1) {
      doc.addPage()
      currentRow = 0
      currentCol = 0
      isFirstPage = false
    }
  }

  return doc.output('datauristring').split(',')[1]
}
