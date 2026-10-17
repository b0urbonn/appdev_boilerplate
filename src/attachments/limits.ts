// Bound raw media reads before allocating base64 (which adds roughly one third).
export const MAX_ATTACHMENT_BYTES = 14 * 1024 * 1024;
export const MAX_INLINE_REQUEST_CHARS = 18 * 1024 * 1024;

export function assertAttachmentSize(size: number, budget = MAX_ATTACHMENT_BYTES): void {
  if (!Number.isFinite(size) || size < 0 || size > Math.min(MAX_ATTACHMENT_BYTES, budget)) {
    throw new Error('Media is too large to process safely. Use a smaller file or start a new chat with fewer attachments.');
  }
}

export function assertDataUrlSize(uri: string, budget = MAX_ATTACHMENT_BYTES): void {
  const comma = uri.indexOf(',');
  if (comma < 0 || comma > 1024 || !uri.slice(0, comma).endsWith(';base64')) {
    throw new Error('Attachment is not a base64 data URL.');
  }
  const length = uri.length - comma - 1;
  const padding = uri.endsWith('==') ? 2 : uri.endsWith('=') ? 1 : 0;
  assertAttachmentSize(Math.max(0, Math.floor(length * 3 / 4) - padding), budget);
}
