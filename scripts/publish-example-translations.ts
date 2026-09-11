import { writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { getOption, hasFlag } from './lib/cli';
import { resolveMeaningsDataset } from './lib/course-datasets';
import { checkExampleTranslation } from './lib/example-checks';
import { nowIso, readJson, readJsonLines } from './lib/io';
import { getWordExample, type Word } from '../src/types';

type ExampleTranslationCandidate = {
  id: string;
  term: string;
  example: string;
  exampleEnglish: string;
};

type ExampleTranslationCorrection = {
  id: string;
  value: string;
  reason: string;
};

// the reading is written straight after the sentence it reads, so a diff of the list
// stays easy to follow instead of showing a new key tacked on the end of every record
function withExampleEnglish(word: Word, value: string): Word {
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(word)) {
    if (key === 'exampleEnglish') continue;
    next[key] = entry;
    if (key === 'exampleFrench' || key === 'exampleSpanish') {
      next.exampleEnglish = value;
    }
  }
  if (!('exampleEnglish' in next)) next.exampleEnglish = value;
  return next as Word;
}

const dataset = resolveMeaningsDataset(getOption('course'));
const candidatesPath = getOption('candidates', dataset.exampleCandidatesPath)!;
const correctionsPath = getOption(
  'corrections',
  dataset.exampleCorrectionsPath,
)!;
const wordsPath = getOption('words', dataset.publishedWordsPath)!;
const allowPartial = hasFlag('allow-partial');

const words = await readJson<Word[]>(wordsPath);

// the last candidate for an id wins, so a re-run can correct an earlier batch
const candidates = new Map<string, ExampleTranslationCandidate>();
for (const candidate of await readJsonLines<ExampleTranslationCandidate>(
  candidatesPath,
)) {
  candidates.set(candidate.id, candidate);
}

const corrections = new Map<string, ExampleTranslationCorrection>();
for (const correction of await readJsonLines<ExampleTranslationCorrection>(
  correctionsPath,
)) {
  corrections.set(correction.id, correction);
}

const rejected: { id: string; term: string; reason: string }[] = [];
let applied = 0;
let corrected = 0;

const published = words.map((word) => {
  const sourceExample = getWordExample(word);
  const correction = corrections.get(word.id);
  const raw = correction?.value ?? candidates.get(word.id)?.exampleEnglish;

  if (typeof raw !== 'string' || !raw.trim()) {
    rejected.push({
      id: word.id,
      term: word.spanish ?? word.french ?? '',
      reason: 'missing',
    });
    // an entry with no reading keeps whatever it already had rather than losing it
    return word;
  }

  const value = raw.normalize('NFC').trim();
  const check = checkExampleTranslation(value, sourceExample);
  if (!check.passed) {
    rejected.push({
      id: word.id,
      term: word.spanish ?? word.french ?? '',
      reason: check.flags.join(', '),
    });
    return word;
  }

  if (correction) corrected += 1;
  applied += 1;
  return withExampleEnglish(word, value);
});

const covered = published.filter((word) => word.exampleEnglish).length;
const failures: string[] = [];
if (covered !== words.length && !allowPartial) {
  failures.push(
    `${covered} of ${words.length} examples have an English reading; re-run translation or pass --allow-partial`,
  );
}

if (failures.length === 0) {
  await writeFile(
    wordsPath,
    await format(JSON.stringify(published), { parser: 'json' }),
    'utf8',
  );
}

await writeFile(
  dataset.exampleAuditPath,
  await format(
    JSON.stringify({
      status: failures.length === 0 ? 'passed' : 'blocked',
      generatedAt: nowIso(),
      course: dataset.courseId,
      applied,
      corrected,
      covered,
      expected: words.length,
      rejectedCount: rejected.length,
      rejected: rejected.slice(0, 40),
      failures,
    }),
    { parser: 'json' },
  ),
  'utf8',
);

console.log(
  `${dataset.courseId}: ${covered}/${words.length} examples carry an English reading (${applied} applied, ${corrected} corrected, ${rejected.length} rejected).`,
);

if (failures.length > 0) {
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
}
