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
