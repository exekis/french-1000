import type { CSSProperties } from 'react';

export type LanguageCode =
  'en' | 'fa' | 'fr' | 'es' | 'de' | 'it' | 'pt' | 'ar' | 'zh';

export type LanguageDefinition = {
  code: LanguageCode;
  label: string;
  endonym: string;
  direction: 'ltr' | 'rtl';
  // languages outside the Latin alphabet need their own stack or they fall back to a
  // face with no coverage and render as boxes
  fontStack?: string;
  // the two reviewed baseline meanings travel inside words.json; the rest are fetched
  // only when a reader asks for them
  bundled: boolean;
};

export const languages: LanguageDefinition[] = [
  {
    code: 'en',
    label: 'English',
    endonym: 'English',
    direction: 'ltr',
    bundled: true,
  },
  {
    code: 'fa',
    label: 'Persian',
    endonym: 'فارسی',
    direction: 'rtl',
    fontStack: "'Geeza Pro', Tahoma, 'Noto Naskh Arabic', sans-serif",
    bundled: true,
  },
  {
    code: 'es',
    label: 'Spanish',
    endonym: 'Español',
    direction: 'ltr',
    bundled: false,
  },
  {
    code: 'de',
    label: 'German',
    endonym: 'Deutsch',
    direction: 'ltr',
    bundled: false,
  },
  {
    code: 'it',
    label: 'Italian',
    endonym: 'Italiano',
    direction: 'ltr',
    bundled: false,
  },
  {
    code: 'pt',
    label: 'Portuguese',
    endonym: 'Português',
    direction: 'ltr',
    bundled: false,
  },
  {
    code: 'ar',
    label: 'Arabic',
    endonym: 'العربية',
    direction: 'rtl',
    fontStack: "'Geeza Pro', Tahoma, 'Noto Naskh Arabic', sans-serif",
    bundled: false,
  },
  {
    code: 'zh',
    label: 'Mandarin',
    endonym: '中文',
    direction: 'ltr',
    fontStack:
      "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
    bundled: false,
  },
];

export const languageByCode = new Map(
  languages.map((language) => [language.code, language]),
);

export const bundledLanguages = languages.filter(
  (language) => language.bundled,
);
export const fetchedLanguages = languages.filter(
  (language) => !language.bundled,
);

export const DEFAULT_LANGUAGES: LanguageCode[] = ['en', 'fa'];

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && languageByCode.has(value as LanguageCode);
}

// the picker always keeps the registry order, so columns never jump around when a
// reader turns one on and off again
export function orderLanguages(codes: readonly LanguageCode[]): LanguageCode[] {
  const chosen = new Set(codes);
  return languages
    .filter((language) => chosen.has(language.code))
    .map((language) => language.code);
}

// precomputed once so a thousand rows do not each build their own style object
export const languageStyles: Partial<Record<LanguageCode, CSSProperties>> =
  Object.fromEntries(
    languages
      .filter((language) => language.fontStack)
      .map((language) => [language.code, { fontFamily: language.fontStack }]),
  );
