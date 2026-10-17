/** Only delete direct children generated inside the app's media directories. */
export function isOwnedMediaFile(uri: string, directory: string): boolean {
  if (!uri.startsWith('file://') || !uri.startsWith(directory)) return false;
  const name = uri.slice(directory.length);
  return name.length > 0 && name !== '.' && name !== '..' && !/[\\/%?#]/.test(name);
}
