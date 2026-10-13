// Web file hand-off: downloads trigger via a temporary <a download> link.
export async function saveFile(name: string, text: string): Promise<void> {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export async function readFile(uri: string): Promise<string> {
  return (await fetch(uri)).text();
}
