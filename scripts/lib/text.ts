import { normalizeSearchText } from '../../src/lib/search';

export type NormalizationResult = {
  value: string;
  changes: string[];
};

const apostrophes = /['‘`´]/g;
const whitespace = /\s+/g;

function removeMalformedControls(value: string): string {
  return [...value]
    .filter((character) => {
      const code = character.codePointAt(0) ?? 0;
      return !(
        code === 0x7f ||
        (code >= 0 && code <= 0x08) ||
        code === 0x0b ||
        code === 0x0c ||
        (code >= 0x0e && code <= 0x1f)
      );
    })
    .join('');
}

export function normalizeCell(input: string): NormalizationResult {
  const changes: string[] = [];
  let value = input;

  const nfc = value.normalize('NFC');
  if (nfc !== value) {
    value = nfc;
    changes.push('unicode-nfc');
  }

  const controlsRemoved = removeMalformedControls(value);
  if (controlsRemoved !== value) {
    value = controlsRemoved;
    changes.push('removed-control-characters');
  }

  const apostrophesNormalized = value.replace(apostrophes, '’');
  if (apostrophesNormalized !== value) {
    value = apostrophesNormalized;
    changes.push('normalized-apostrophes');
  }

  const whitespaceNormalized = value.replace(whitespace, ' ').trim();
  if (whitespaceNormalized !== value) {
    value = whitespaceNormalized;
    changes.push('normalized-whitespace');
  }

  return { value, changes };
}

export function normalizeFrenchIdentity(value: string): string {
  return normalizeCell(value).value.toLocaleLowerCase('fr');
}

const riskWords: Record<string, string[]> = {
  plus: ['homograph', 'negation', 'pronunciation-sensitive'],
  est: ['homograph', 'inflection-sensitive', 'pronunciation-sensitive'],
  tous: ['pronunciation-sensitive', 'inflection-sensitive'],
  fils: ['homograph', 'pronunciation-sensitive'],
  que: ['conjunction', 'pronoun', 'function-word'],
  y: ['pronoun', 'function-word'],
  en: ['preposition', 'pronoun', 'function-word'],
  de: ['preposition', 'function-word'],
  chez: ['preposition', 'function-word'],
};

const articles = new Set([
  'le',
  'la',
  'les',
  'un',
  'une',
  'des',
  'du',
  'au',
  'aux',
]);
const prepositions = new Set([
  'a',
  'à',
  'apres',
  'après',
  'avant',
  'avec',
  'dans',
  'de',
  'depuis',
  'en',
  'par',
  'pour',
  'sans',
  'sous',
  'sur',
]);
const pronouns = new Set([
  'ce',
  'cela',
  'elle',
  'elles',
  'en',
  'il',
  'ils',
  'je',
  'lui',
  'me',
  'moi',
  'nous',
  'on',
  'que',
  'qui',
  'se',
  'te',
  'toi',
  'tu',
  'vous',
  'y',
]);
const conjunctions = new Set([
  'car',
  'comme',
  'donc',
  'et',
  'mais',
  'ni',
  'ou',
  'parce que',
  'que',
  'quand',
  'si',
]);

export function classifyRisk(french: string): string[] {
  const normalized = normalizeSearchText(french);
  const flags = new Set(riskWords[normalized] ?? []);

  if (articles.has(normalized)) flags.add('article');
  if (prepositions.has(normalized)) flags.add('preposition');
  if (pronouns.has(normalized)) flags.add('pronoun');
  if (conjunctions.has(normalized)) flags.add('conjunction');
  if (flags.size > 0) flags.add('function-word');

  return flags.size === 0 ? ['ordinary-lexical-item'] : [...flags].toSorted();
}

export function zeroPadRank(rank: number): string {
  return String(rank).padStart(4, '0');
}

export function filenameSlug(value: string): string {
  const slug = normalizeSearchText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'word';
}
