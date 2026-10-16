/** "Just now", "5 min ago", "3 h ago", "Yesterday", or a locale date. */
export function relativeTime(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  if (hours < 48) return 'Yesterday';
  return new Date(ts).toLocaleDateString();
}
