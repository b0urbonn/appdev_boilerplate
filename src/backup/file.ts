// Native file hand-off: write to the cache dir, then open the share sheet so
// the user can save the backup to Files/Drive/etc.
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export async function saveFile(name: string, text: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, text);
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    dialogTitle: 'Save backup',
  });
}

export async function readFile(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri);
}
