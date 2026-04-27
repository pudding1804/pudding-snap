const GAME_ID_PATTERN = /^[0-9a-f]{8,16}$/

export function formatGameTitle(displayTitle, gameTitle) {
  const title = displayTitle || gameTitle
  if (!title) return 'Loading...'
  if (GAME_ID_PATTERN.test(title)) return 'Loading...'
  return title
}
