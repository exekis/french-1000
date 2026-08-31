import 'dotenv/config';
import { getNumberOption, getOption, hasFlag } from './lib/cli';
import { checkExample, findDuplicateExamples } from './lib/example-checks';
import {
  appendJsonLine,
  nowIso,
  readJson,
  readJsonLines,
  writeJson,
} from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type {
  ExampleApproval,
  ExampleCandidate,
  ExampleReview,
  ImportedWord,
} from './lib/pipeline-types';
import { withRetry } from './lib/retry';
import {
  createModelClient,
  requestStructuredOutput,
} from './lib/structured-output';
import { exampleReviewOutputSchema, importedWordSchema } from './lib/schemas';

const promptVersion = 'example-review-v1';
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
const model = getOption('model', process.env.OPENAI_REVIEW_MODEL);
const baseURL = getOption('base-url', process.env.OPENAI_BASE_URL);
const batchSize = getNumberOption('batch-size', 20);
const concurrency = getNumberOption('concurrency', 1);
const offline = hasFlag('offline');

const rawWords = await readJson<unknown[]>(wordsPath);
const words = rawWords.map((record, index) => {
  const parsed = importedWordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(
      `Invalid imported word at index ${index}: ${parsed.error.message}`,
    );
  }
  return parsed.data as ImportedWord;
});
await requirePassedImportAudit(
  fromRoot('data/curated/import-audit.json'),
  words.length,
);
const wordsById = new Map(words.map((word) => [word.id, word]));

const allCandidates = await readJsonLines<ExampleCandidate>(candidatesPath);
const candidatesById = new Map<string, ExampleCandidate>();
allCandidates.forEach((candidate) =>
  candidatesById.set(candidate.id, candidate),
);
const candidates = [...candidatesById.values()].toSorted(
  (a, b) => a.rank - b.rank,
);
const duplicates = findDuplicateExamples(candidates);
const duplicateIds = new Set([...duplicates.values()].flat());

let reviews = await readJsonLines<ExampleReview>(reviewsPath);
const reviewedIds = new Set(reviews.map((review) => review.id));
const pending = candidates.filter(
  (candidate) => !reviewedIds.has(candidate.id),
);

if (!offline) {
  if (!model) throw new Error('OPENAI_REVIEW_MODEL or --model is required');

  const client = createModelClient(baseURL);
  const systemPrompt = `You independently review beginner French teaching examples.

For every input record, return exactly one entry with the same id. Assess whether the sentence:
- demonstrates the supplied English and Persian sense
- is grammatical and natural contemporary French
- is suitable for an A1 or A2 learner
- genuinely teaches the listed word or a justified recorded inflection

Choose approve only if all five boolean checks are true. Give concise reasons for any problem. Suggestions are nullable and must be null for an approved entry. Do not defer to the generator.`;

  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('--concurrency must be a positive integer');
  }

  const batches: ExampleCandidate[][] = [];
  for (let index = 0; index < pending.length; index += batchSize) {
    batches.push(pending.slice(index, index + batchSize));
  }

  for (let index = 0; index < batches.length; index += concurrency) {
    const group = batches.slice(index, index + concurrency);
    const reviewed = await Promise.all(
      group.map(async (batch) => {
        const response = await withRetry(() =>
          requestStructuredOutput({
            client,
            model,
            name: 'french_example_review_batch',
            schema: exampleReviewOutputSchema,
            systemPrompt,
            userPrompt: `Input records:\n${JSON.stringify(
              batch.map((candidate) => ({
                ...wordsById.get(candidate.id),
                exampleFrench: candidate.exampleFrench,
                exampleTarget: candidate.exampleTarget,
                deterministicCheck: checkExample(
                  candidate,
                  wordsById.get(candidate.id)!,
                ),
              })),
            )}`,
            compatibleEndpoint: Boolean(baseURL),
          }),
        );

        const byId = new Map(
          response.parsed.entries.map((entry) => [entry.id, entry]),
        );
        const expectedIds = new Set(batch.map((candidate) => candidate.id));
        const unexpected = [...byId.keys()].filter(
          (id) => !expectedIds.has(id),
        );
        if (byId.size !== batch.length || unexpected.length > 0) {
          throw new Error(
            `Review response returned mismatched ids: ${unexpected.join(', ') || 'missing or duplicate ids'}`,
          );
        }

        return {
          batch,
          response,
          entries: batch.map((candidate): ExampleReview => {
            const entry = byId.get(candidate.id);
            if (!entry) {
              throw new Error(`Review response omitted ${candidate.id}`);
            }
            return { ...entry, model, reviewedAt: nowIso() };
          }),
        };
      }),
    );

    for (const result of reviewed) {
      for (const review of result.entries) {
        await appendJsonLine(reviewsPath, review);
      }
      await appendJsonLine(fromRoot('data/local/example-review-log.jsonl'), {
        responseId: result.response.id,
        model,
        promptVersion,
        ids: result.batch.map((candidate) => candidate.id),
        usage: result.response.usage,
        completedAt: nowIso(),
      });
    }
  }
  reviews = await readJsonLines<ExampleReview>(reviewsPath);
}

const reviewById = new Map<string, ExampleReview>();
reviews.forEach((review) => reviewById.set(review.id, review));
const autoApprovals: ExampleApproval[] = [];
const queue: Record<string, unknown>[] = [];

for (const candidate of candidates) {
  const word = wordsById.get(candidate.id);
  if (!word) throw new Error(`Candidate ${candidate.id} has no imported word`);
  const deterministic = checkExample(candidate, word);
  const review = reviewById.get(candidate.id);
  const reasons: string[] = [...deterministic.flags];

  if (duplicateIds.has(candidate.id)) reasons.push('duplicate-example');
  if (!review) reasons.push('second-pass-review-missing');
  if (review?.decision !== 'approve')
    reasons.push('second-pass-review-not-approved');
  if (
    review &&
    ![
      review.senseAligned,
      review.grammatical,
      review.natural,
      review.beginnerSuitable,
      review.targetTaught,
    ].every(Boolean)
  ) {
    reasons.push('second-pass-review-check-failed');
  }

  if (reasons.length === 0 && review) {
    autoApprovals.push({
      id: candidate.id,
      exampleFrench: candidate.exampleFrench,
      exampleTarget: candidate.exampleTarget,
      status: 'auto-checked',
      approvedAt: review.reviewedAt,
      reviewerReference: `second-pass-model:${review.model}`,
    });
  } else {
    queue.push({
      id: candidate.id,
      rank: candidate.rank,
      french: candidate.french,
      english: word.english,
      persian: word.persian,
      exampleFrench: candidate.exampleFrench,
      exampleTarget: candidate.exampleTarget,
      reasons: [...new Set(reasons)].toSorted(),
      deterministic,
      secondPassReview: review ?? null,
    });
  }
}

await writeJson(
  fromRoot('data/curated/example-approvals.auto.json'),
  autoApprovals,
);
await writeJson(fromRoot('data/curated/example-review-queue.json'), queue);

console.log(
  `Review outputs updated: ${autoApprovals.length} auto-approved, ${queue.length} require manual review.`,
);
