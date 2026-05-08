const IMAGE_MIME = 'image/jpeg'

function formatTimestamp(ts) {
  const d = new Date(ts * 1000)
  return d.toLocaleString()
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function generateHtmlExport(screenshots, imagesBase64, gameInfo, t) {
  const bst = t.batch_share || {}
  const gameTitle = gameInfo?.display_title || gameInfo?.game_title || 'Game'
  const rating = gameInfo?.rating != null && gameInfo?.rating >= 0 ? gameInfo.rating : null
  const noNote = bst.no_note || '无附注'

  const screenshotCards = screenshots.map((ss, i) => {
    const mimeType = IMAGE_MIME
    const imgSrc = `data:${mimeType};base64,${imagesBase64[i] || ''}`
    const note = ss.note ? escapeHtml(ss.note) : noNote
    const time = formatTimestamp(ss.timestamp)

    return `
      <div class="screenshot-card">
        <div class="img-wrapper">
          <img src="${imgSrc}" alt="Screenshot ${i + 1}" loading="lazy" onclick="openLightbox(${i})" />
        </div>
        <div class="meta">
          <p class="note">${note}</p>
          <p class="time">${time}</p>
        </div>
      </div>`
  }).join('')

  const ratingHtml = rating !== null
    ? `<div class="rating">★ ${rating}/10</div>`
    : ''

  const lightboxImages = screenshots.map((ss, i) => {
    return `data:${IMAGE_MIME};base64,${imagesBase64[i] || ''}`
  })

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(gameTitle)} - Screenshots</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', 'Microsoft YaHei', sans-serif;
    background: #1a1a2e;
    color: #e0e0e0;
    min-height: 100vh;
  }
  .header {
    text-align: center;
    padding: 48px 24px 32px;
    background: linear-gradient(135deg, #16213e 0%, #0f3460 100%);
    border-bottom: 1px solid #2a2a4a;
  }
  .header h1 {
    font-size: 28px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 8px;
  }
  .header .rating {
    font-size: 18px;
    color: #ffd700;
    margin-top: 8px;
  }
  .header .count {
    font-size: 14px;
    color: #8888aa;
    margin-top: 6px;
  }
  .gallery {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 20px;
  }
  .screenshot-card {
    background: #16213e;
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #2a2a4a;
    transition: transform 0.2s, box-shadow 0.2s;
  }
  .screenshot-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  }
  .img-wrapper {
    width: 100%;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    cursor: pointer;
    position: relative;
    background: #0f0f23;
  }
  .img-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    transition: transform 0.2s;
  }
  .img-wrapper:hover img {
    transform: scale(1.02);
  }
  .meta {
    padding: 12px 16px;
  }
  .meta .note {
    font-size: 13px;
    color: #ccccdd;
    margin-bottom: 4px;
    line-height: 1.4;
    word-break: break-word;
  }
  .meta .time {
    font-size: 11px;
    color: #666688;
  }
  .lightbox {
    display: none;
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.92);
    z-index: 9999;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  }
  .lightbox.active {
    display: flex;
  }
  .lightbox img {
    max-width: 95vw;
    max-height: 95vh;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 0 40px rgba(0,0,0,0.5);
  }
  .lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    font-size: 24px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10000;
  }
  .lightbox-nav:hover {
    background: rgba(255,255,255,0.3);
  }
  .lightbox-prev { left: 20px; }
  .lightbox-next { right: 20px; }
  .lightbox-close {
    position: absolute;
    top: 20px;
    right: 20px;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: rgba(255,255,255,0.15);
    border: none;
    color: #fff;
    font-size: 22px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
    z-index: 10000;
  }
  .lightbox-close:hover {
    background: rgba(255,255,255,0.3);
  }
  .lightbox-counter {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: #aaa;
    font-size: 14px;
    z-index: 10000;
  }
  @media (max-width: 768px) {
    .gallery {
      grid-template-columns: 1fr;
      padding: 12px;
    }
    .header h1 { font-size: 22px; }
  }
</style>
</head>
<body>

<div class="header">
  <h1>${escapeHtml(gameTitle)}</h1>
  ${ratingHtml}
  <div class="count">${screenshots.length} screenshots</div>
</div>

<div class="gallery">
  ${screenshotCards}
</div>

<div class="lightbox" id="lightbox" onclick="closeLightbox(event)">
  <button class="lightbox-close" onclick="closeLightbox(event)">✕</button>
  <button class="lightbox-nav lightbox-prev" onclick="navigateLightbox(event, -1)">‹</button>
  <img id="lightbox-img" src="" alt="Full size" />
  <button class="lightbox-nav lightbox-next" onclick="navigateLightbox(event, 1)">›</button>
  <div class="lightbox-counter" id="lightbox-counter"></div>
</div>

<script>
const images = ${JSON.stringify(lightboxImages)};
let currentIndex = 0;

function openLightbox(index) {
  currentIndex = index;
  const lb = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  img.src = images[index];
  counter.textContent = (index + 1) + ' / ' + images.length;
  lb.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLightbox(e) {
  if (e && e.target && (e.target.tagName === 'IMG' || e.target.classList.contains('lightbox-nav'))) return;
  const lb = document.getElementById('lightbox');
  lb.classList.remove('active');
  document.body.style.overflow = '';
}

function navigateLightbox(e, delta) {
  e.stopPropagation();
  currentIndex = (currentIndex + delta + images.length) % images.length;
  const img = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  img.src = images[currentIndex];
  counter.textContent = (currentIndex + 1) + ' / ' + images.length;
}

document.addEventListener('keydown', function(e) {
  const lb = document.getElementById('lightbox');
  if (!lb.classList.contains('active')) return;
  if (e.key === 'Escape') { lb.classList.remove('active'); document.body.style.overflow = ''; }
  if (e.key === 'ArrowLeft') navigateLightbox(e, -1);
  if (e.key === 'ArrowRight') navigateLightbox(e, 1);
});
</script>
</body>
</html>`
}
