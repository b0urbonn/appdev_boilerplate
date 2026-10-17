export async function readClipboardText(): Promise<string> {
  if (!navigator.clipboard?.readText) throw new Error('Click the message field and use Ctrl+V or Cmd+V to paste your link.');
  let text: string;
  try { text = await navigator.clipboard.readText(); }
  catch { throw new Error('Clipboard access was blocked. Click the message field and press Ctrl+V or Cmd+V.'); }
  if (!text.trim()) throw new Error('Copy the post link first, then tap Paste link.');
  return text.slice(0, 5000);
}
