export async function temporaryMedia(base64: string, mime: string) {
  return { uri: `data:${mime};base64,${base64}`, dispose: async () => {} };
}
