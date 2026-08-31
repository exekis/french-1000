import { checkExample, findDuplicateExamples } from './lib/example-checks';
import { getOption } from './lib/cli';
import {
  nowIso,
  readJson,
  readJsonLines,
  writeJson,
  writeJsonLines,
} from './lib/io';
import { fromRoot } from './lib/paths';
import type {
  ExampleCandidate,
  ExampleReview,
  ImportedWord,
} from './lib/pipeline-types';

const wordsPath = getOption(
  'words',
  fromRoot('data/curated/imported-words.json'),
)!;
const candidatesPath = getOption(
  'candidates',
  fromRoot('data/curated/example-candidates.jsonl'),
)!;
const reviewsPath = getOption(
  'reviews',
  fromRoot('data/curated/example-reviews.jsonl'),
)!;

const words = await readJson<ImportedWord[]>(wordsPath);
const wordsById = new Map(words.map((word) => [word.id, word]));
const allCandidates = await readJsonLines<ExampleCandidate>(candidatesPath);
const candidatesById = new Map<string, ExampleCandidate>();
allCandidates.forEach((candidate) =>
  candidatesById.set(candidate.id, candidate),
);
const candidates = [...candidatesById.values()].toSorted(
  (left, right) => left.rank - right.rank,
);
const duplicateIds = new Set(
  [...findDuplicateExamples(candidates).values()].flat(),
);
const reviews = await readJsonLines<ExampleReview>(reviewsPath);
const reviewsById = new Map<string, ExampleReview>();
reviews.forEach((review) => reviewsById.set(review.id, review));
const removed = candidates
  .map((candidate) => {
    const word = wordsById.get(candidate.id);
    if (!word) {
      return { candidate, flags: ['source-word-missing'] };
    }
    const check = checkExample(candidate, word);
    const flags = [
      ...check.flags,
      ...(duplicateIds.has(candidate.id) ? ['duplicate-example'] : []),
    ];
    const review = reviewsById.get(candidate.id);
    if (
      review &&
      (review.decision !== 'approve' ||
        ![
          review.senseAligned,
          review.grammatical,
          review.natural,
          review.beginnerSuitable,
          review.targetTaught,
        ].every(Boolean))
    ) {
      flags.push('second-pass-review-rejected');
    }
    return { candidate, flags: [...new Set(flags)] };
  })
  .filter((item) => item.flags.length > 0);
const removedIds = new Set(removed.map((item) => item.candidate.id));
const retained = candidates.filter(
  (candidate) => !removedIds.has(candidate.id),
);
const retainedReviews = reviews.filter((review) => !removedIds.has(review.id));

await writeJsonLines(candidatesPath, retained);
await writeJsonLines(reviewsPath, retainedReviews);
await writeJson(fromRoot('data/curated/pruned-example-report.json'), {
  generatedAt: nowIso(),
  retainedCount: retained.length,
  removedCount: removed.length,
  removed: removed.map((item) => ({
    id: item.candidate.id,
    rank: item.candidate.rank,
    french: item.candidate.french,
    exampleFrench: item.candidate.exampleFrench,
    exampleTarget: item.candidate.exampleTarget,
    flags: item.flags,
  })),
});

console.log(
  `Retained ${retained.length} candidates and removed ${removed.length} invalid candidates for regeneration.`,
);
