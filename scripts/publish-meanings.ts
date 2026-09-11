import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import {
  type LanguageCode,
  isLanguageCode,
  languageByCode,
} from '../src/lib/languages';
import { getOption, hasFlag } from './lib/cli';
import { readCourseWords, resolveMeaningsDataset } from './lib/course-datasets';
import { checkMeaning, normalizeMeaning } from './lib/meaning-checks';
import { nowIso, readJsonLines } from './lib/io';

type MeaningCandidate = {
  id: string;
  term: string;
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

type MeaningCorrection = {
  id: string;
  code: string;
  value: string;
  reason: string;
};

const dataset = resolveMeaningsDataset(getOption('course'));
const candidatesPath = getOption('candidates', dataset.candidatesPath)!;
const reviewsPath = getOption('reviews', dataset.reviewsPath)!;
const correctionsPath = getOption('corrections', dataset.correctionsPath)!;
const wordsPath = getOption('words', dataset.wordsPath)!;
const outputDirectory = getOption('out', dataset.outputDirectory)!;
const allowPartial = hasFlag('allow-partial');

const requested = (getOption('languages') ?? dataset.defaultLanguages)
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);
for (const code of requested) {
  if (!isLanguageCode(code)) throw new Error(`Unknown language code ${code}`);
}
const codes = requested as LanguageCode[];

const words = await readCourseWords({ ...dataset, wordsPath });

// the last candidate for an id wins, so a re-run can correct an earlier batch
const candidates = new Map<string, MeaningCandidate>();
for (const candidate of await readJsonLines<MeaningCandidate>(candidatesPath)) {
  candidates.set(candidate.id, candidate);
}

const reviews = new Map<string, MeaningReview>();
for (const review of await readJsonLines<MeaningReview>(reviewsPath)) {
  reviews.set(`${review.id}:${review.code}`, review);
}
// a review pass is a second model read over the whole list. a correction is a single
// entry someone fixed by hand, and a handful of those must not let a file claim it was
// reviewed, so the two are counted separately
const corrections = new Map<string, MeaningCorrection>();
for (const correction of await readJsonLines<MeaningCorrection>(
  correctionsPath,
)) {
  corrections.set(`${correction.id}:${correction.code}`, correction);
}
const reviewed = reviews.size > 0;

const audit: Record<string, unknown>[] = [];
const failures: string[] = [];

for (const code of codes) {
  const language = languageByCode.get(code)!;
  const meanings: Record<string, string> = {};
  let correctionCount = 0;
  const rejected: { id: string; term: string; reason: string }[] = [];
  const warned: {
    id: string;
    term: string;
    value: string;
    warnings: string[];
  }[] = [];
  const disputed: {
    id: string;
    term: string;
    kept: string;
    reason: string;
  }[] = [];

  for (const word of words) {
    const candidate = candidates.get(word.id);
    const raw = candidate?.meanings[code];
    if (typeof raw !== 'string' || !raw.trim()) {
      rejected.push({ id: word.id, term: word.term, reason: 'missing' });
      continue;
    }

    const review = reviews.get(`${word.id}:${code}`);
    const correction = corrections.get(`${word.id}:${code}`);
    if (correction) correctionCount += 1;
    const value = normalizeMeaning(
      correction?.value ?? review?.suggested ?? raw,
    );

    // a reviewer that rejects without offering a replacement is only disagreeing, and
    // that has proven unreliable: it has rejected correct translations such as matin
    // as mañana. one model disagreeing with another is not enough evidence to delete a
    // meaning that already passed every deterministic check, so the original is kept
    // and the disagreement is recorded for a human to settle
    if (review?.decision === 'reject' && !review.suggested) {
      disputed.push({
        id: word.id,
        term: word.term,
        kept: normalizeMeaning(raw),
        reason: review.reason ?? '',
      });
    }

    const check = checkMeaning(value, word.term, code);
    if (!check.passed) {
      rejected.push({
        id: word.id,
        term: word.term,
        reason: check.flags.join(', '),
      });
      continue;
    }

    if (check.warnings.length > 0) {
      warned.push({
        id: word.id,
        term: word.term,
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
    correctedEntries: correctionCount,
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
    correctionCount,
    rejectedCount: rejected.length,
    rejected: rejected.slice(0, 40),
    warnedCount: warned.length,
    warned: warned.slice(0, 40),
    disputedCount: disputed.length,
    disputed: disputed.slice(0, 40),
  });
  console.log(
    `${code}: published ${covered}/${words.length} meanings (${rejected.length} rejected, ${warned.length} flagged, ${disputed.length} disputed, ${correctionCount} corrected).`,
  );
}

// written through prettier like the language files, so the repository format check
// does not trip over the way JSON.stringify expands short arrays
await writeFile(
  dataset.auditPath,
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
