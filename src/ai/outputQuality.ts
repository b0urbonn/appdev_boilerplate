/** Detect severe output loops without rejecting normal multilingual text. */
export function hasDegenerateRepetition(text: string): boolean {
  const tail = text.slice(-512).replace(/\s+/g, ' ').toLocaleLowerCase();
  // At least 64 consecutive characters consisting of the same small unit.
  for (let size = 1; size <= 48; size++) {
    const repetitions = Math.max(8, Math.ceil(64 / size));
    if (tail.length < size * repetitions) continue;
    const unit = tail.slice(-size);
    if (!/\p{L}/u.test(unit)) continue; // punctuation, indentation and separators
    if (tail.endsWith(unit.repeat(repetitions))) return true;
  }
  return false;
}

/** Conservative check for the reported English → unrelated CJK failure. */
export function hasUnexpectedLanguage(userText: string, answer: string): boolean {
  if (!userText.trim() || /[^\x00-\x7F]/.test(userText)) return false;
  if (/translat|language|chinese|mandarin|cantonese|japanese|korean|multilingual|bilingual/i.test(userText)) return false;
  const words = userText.match(/[a-z]+/gi) ?? [];
  if (words.length < 3 && !/^(hi|hello|hey|thanks|thank you)[!.?\s]*$/i.test(userText.trim())) return false;
  const cjk = answer.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const letters = answer.match(/\p{L}/gu)?.length ?? 0;
  return cjk >= 10 && cjk > letters * 0.35;
}
