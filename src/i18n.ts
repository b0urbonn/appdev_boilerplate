export type AppLanguage = 'en' | 'tl';

export function localize(language: AppLanguage, english: string, tagalog: string) {
  return language === 'tl' ? tagalog : english;
}

export function localeFor(language: AppLanguage) {
  return language === 'tl' ? 'fil-PH' : 'en-US';
}
