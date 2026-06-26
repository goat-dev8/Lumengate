/** Relative time for activity feeds — no fake timestamps. */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const sec = Math.floor((now - timestamp) / 1000);
  if (sec < 60) return sec <= 1 ? 'Just now' : `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? '1 min ago' : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
