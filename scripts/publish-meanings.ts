import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import {
  type LanguageCode,
  isLanguageCode,
  languageByCode,
} from '../src/lib/languages';
import { getOption, hasFlag } from './lib/cli';
import { checkMeaning } from './lib/meaning-checks';
import { nowIso, readJson, readJsonLines } from './lib/io';
import { fromRoot } from './lib/paths';
import type { ImportedWord } from './lib/pipeline-types';
import { importedWordSchema } from './lib/schemas';

type MeaningCandidate = {
  id: string;
  french: string;
  meanings: Record<string, string>;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

type MeaningReview = {
  id: string;
  code: string;
  decision: 'approve' | 'reject';
  reason?: string;
  suggested: string | null;
};

const candidatesPath = getOption(
  'candidates',
  fromRoot('data/curated/meaning-candidates.jsonl'),
)!;
const reviewsPath = getOption(
  'reviews',
  fromRoot('data/curated/meaning-reviews.jsonl'),
)!;
const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const outputDirectory = getOption('out', fromRoot('src/data/meanings'))!;
const allowPartial = hasFlag('allow-partial');

const requested = (getOption('languages') ?? 'es,de,it,pt,ar,zh')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);
for (const code of requested) {
  if (!isLanguageCode(code)) throw new Error(`Unknown language code ${code}`);
}
const codes = requested as LanguageCode[];

const rawWords = await readJson<unknown[]>(wordsPath);
const words = rawWords.map((record, index) => {
  const parsed = importedWordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid imported word ${index}: ${parsed.error.message}`);
  }
  return parsed.data as ImportedWord;
});

// the last candidate for an id wins, so a re-run can correct an earlier batch
const candidates = new Map<string, MeaningCandidate>();
for (const candidate of await readJsonLines<MeaningCandidate>(candidatesPath)) {
  candidates.set(candidate.id, candidate);
}

const reviews = new Map<string, MeaningReview>();
for (const review of await readJsonLines<MeaningReview>(reviewsPath)) {
  reviews.set(`${review.id}:${review.code}`, review);
}
const reviewed = reviews.size > 0;

const audit: Record<string, unknown>[] = [];
const failures: string[] = [];

for (const code of codes) {
  const language = languageByCode.get(code)!;
  const meanings: Record<string, string> = {};
  const rejected: { id: string; french: string; reason: string }[] = [];
  const warned: {
    id: string;
    french: string;
    value: string;
    warnings: string[];
  }[] = [];
  const disputed: {
    id: string;
    french: string;
    kept: string;
    reason: string;
  }[] = [];

  for (const word of words) {
    const candidate = candidates.get(word.id);
    const raw = candidate?.meanings[code];
    if (typeof raw !== 'string' || !raw.trim()) {
      rejected.push({ id: word.id, french: word.french, reason: 'missing' });
      continue;
    }

    const review = reviews.get(`${word.id}:${code}`);
    const value = (review?.suggested ?? raw).normalize('NFC').trim();

    // a reviewer that rejects without offering a replacement is only disagreeing, and
    // that has proven unreliable: it has rejected correct translations such as matin
    // as mañana. one model disagreeing with another is not enough evidence to delete a
    // meaning that already passed every deterministic check, so the original is kept
    // and the disagreement is recorded for a human to settle
    if (review?.decision === 'reject' && !review.suggested) {
      disputed.push({
        id: word.id,
        french: word.french,
        kept: raw.normalize('NFC').trim(),
        reason: review.reason ?? '',
      });
    }

    const check = checkMeaning(value, word.french, code);
    if (!check.passed) {
      rejected.push({
        id: word.id,
        french: word.french,
        reason: check.flags.join(', '),
      });
      continue;
    }

    if (check.warnings.length > 0) {
      warned.push({
        id: word.id,
        french: word.french,
        value,
        warnings: check.warnings,
      });
    }
    meanings[word.id] = value;
  }

  const covered = Object.keys(meanings).length;
  if (covered !== words.length && !allowPartial) {
    failures.push(
      `${code} covers ${covered} of ${words.length} words; re-run generation or pass --allow-partial`,
    );
  }

  const payload = {
    code,
    label: language.label,
    // an unreviewed file is labelled as such rather than quietly claiming a second pass
    reviewStatus: reviewed ? 'auto-checked' : 'generated',
    reviewedEntries: reviews.size,
    coveredWords: covered,
    expectedWords: words.length,
    generatedAt: nowIso(),
    meanings,
  };

  await writeFile(
    `${outputDirectory}/${code}.json`,
    await format(JSON.stringify(payload), { parser: 'json' }),
    'utf8',
  );

  audit.push({
    code,
    covered,
    expected: words.length,
    rejectedCount: rejected.length,
    rejected: rejected.slice(0, 40),
    warnedCount: warned.length,
    warned: warned.slice(0, 40),
    disputedCount: disputed.length,
    disputed: disputed.slice(0, 40),
  });
  console.log(
    `${code}: published ${covered}/${words.length} meanings (${rejected.length} rejected, ${warned.length} flagged, ${disputed.length} disputed).`,
  );
}

// written through prettier like the language files, so the repository format check
// does not trip over the way JSON.stringify expands short arrays
await writeFile(
  fromRoot('data/curated/meaning-audit.json'),
  await format(
    JSON.stringify({
      status: failures.length === 0 ? 'passed' : 'blocked',
      generatedAt: nowIso(),
      reviewed,
      languages: audit,
      failures,
    }),
    { parser: 'json' },
  ),
  'utf8',
);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}
