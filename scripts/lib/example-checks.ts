import { normalizeSearchText } from '../../src/lib/search';
import type {
  ExampleCandidate,
  ExampleCheck,
  ImportedWord,
} from './pipeline-types';

const placeholders = /\b(?:todo|tbd|placeholder|example)\b/i;
const sentencePunctuation = /[.!?…]$/u;
const apostrophes = /[’‘`´]/g;

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function containsExampleTarget(
  sentence: string,
  target: string,
): boolean {
  const normalizedSentence = sentence
    .normalize('NFC')
    .replace(apostrophes, "'")
    .toLocaleLowerCase('fr');
  const normalizedTarget = target
    .normalize('NFC')
    .replace(apostrophes, "'")
    .toLocaleLowerCase('fr');
  if (!normalizedTarget) return false;
  return new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${escapeRegularExpression(normalizedTarget)}(?=$|[^\\p{L}\\p{N}])`,
    'u',
  ).test(normalizedSentence);
}

export function checkExample(
  candidate: Pick<ExampleCandidate, 'exampleFrench' | 'exampleTarget'>,
  _word: Pick<ImportedWord, 'french'>,
): ExampleCheck {
  const flags: string[] = [];
  const normalizedTarget = normalizeSearchText(candidate.exampleTarget);
  const wordCount = candidate.exampleFrench
    .trim()
    .split(/[\s’'-]+/u)
    .filter(Boolean).length;

  if (
    !containsExampleTarget(candidate.exampleFrench, candidate.exampleTarget)
  ) {
    flags.push('target-not-present');
  }
  if (wordCount < 3) flags.push('too-short');
  if (wordCount > 12) flags.push('too-long');
  if (!sentencePunctuation.test(candidate.exampleFrench.trim())) {
    flags.push('missing-sentence-punctuation');
  }
  if (placeholders.test(candidate.exampleFrench)) flags.push('placeholder');
  if (candidate.exampleFrench !== candidate.exampleFrench.normalize('NFC')) {
    flags.push('not-unicode-nfc');
  }
  if (!normalizedTarget) flags.push('invalid-inflection-target');

  return { passed: flags.length === 0, flags, wordCount };
}

export function findDuplicateExamples(
  candidates: readonly Pick<ExampleCandidate, 'id' | 'exampleFrench'>[],
): Map<string, string[]> {
  const idsByExample = new Map<string, string[]>();
  for (const candidate of candidates) {
    const key = normalizeSearchText(candidate.exampleFrench);
    idsByExample.set(key, [...(idsByExample.get(key) ?? []), candidate.id]);
  }

  return new Map([...idsByExample].filter(([, ids]) => ids.length > 1));
}

// an english reading of the example is a whole sentence, not a gloss, so it gets its
// own bounds rather than reusing the meaning checks
const nonLatinScript = /[\u0600-\u06FF\u0750-\u077F\u4E00-\u9FFF\u3400-\u4DBF]/;
// the source-sentence placeholder list cannot be reused here, because "example" is
// the ordinary english reading of exemple and ejemplo rather than a sign of a stub
const translationPlaceholders = /\b(?:tbd|placeholder|lorem ipsum)\b/i;
const MAX_TRANSLATION_LENGTH = 160;

export function checkExampleTranslation(
  translation: string,
  sourceExample: string,
): ExampleCheck {
  const flags: string[] = [];
  const value = translation.normalize('NFC').trim();
  const wordCount = value.split(/[\s’'-]+/u).filter(Boolean).length;

  if (!value) flags.push('empty');
  if (value.length > MAX_TRANSLATION_LENGTH) flags.push('too-long');
  if (/[\r\n\t]/.test(translation)) flags.push('contains-line-breaks');
  if (value && !sentencePunctuation.test(value)) {
    flags.push('missing-sentence-punctuation');
  }
  if (nonLatinScript.test(value)) flags.push('not-english-script');
  if (translationPlaceholders.test(value)) flags.push('placeholder');
  if (translation !== translation.normalize('NFC'))
    flags.push('not-unicode-nfc');
  // a model that hands the source sentence back has translated nothing
  if (
    value &&
    normalizeSearchText(value) === normalizeSearchText(sourceExample)
  ) {
    flags.push('copies-the-source');
  }

  return { passed: flags.length === 0, flags, wordCount };
}
