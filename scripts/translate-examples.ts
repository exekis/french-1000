import 'dotenv/config';
import { z } from 'zod/v4';
import { getNumberOption, getOption } from './lib/cli';
import {
  type CourseExample,
  readCourseExamples,
  resolveMeaningsDataset,
} from './lib/course-datasets';
import { checkExampleTranslation } from './lib/example-checks';
import { appendJsonLine, nowIso, readJsonLines } from './lib/io';
import { withRetry } from './lib/retry';
import {
  createModelClient,
  requestStructuredOutput,
} from './lib/structured-output';

const promptVersion = 'example-translations-v1';
const dataset = resolveMeaningsDataset(getOption('course'));
const inputPath = getOption('input', dataset.publishedWordsPath)!;
const outputPath = getOption('output', dataset.exampleCandidatesPath)!;
const batchSize = getNumberOption('batch-size', 8);
const concurrency = getNumberOption('concurrency', 3);
const startRank = getNumberOption('start-rank', 1);
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const model = getOption('model', process.env.OPENAI_MEANING_MODEL);
const baseURL = getOption('base-url', process.env.OPENAI_BASE_URL);

if (!model) throw new Error('OPENAI_MEANING_MODEL or --model is required');
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('--concurrency must be a positive integer');
}

const words = await readCourseExamples({
  ...dataset,
  publishedWordsPath: inputPath,
});

type ExampleTranslationCandidate = {
  id: string;
  rank: number;
  term: string;
  example: string;
  exampleEnglish: string;
  flags: string[];
  model: string;
  promptVersion: string;
  generatedAt: string;
};

const outputSchema = z.object({
  entries: z.array(z.object({ id: z.string(), en: z.string() })),
});

const existing = await readJsonLines<ExampleTranslationCandidate>(outputPath);
const completed = new Set(
  existing
    .filter((candidate) => typeof candidate.exampleEnglish === 'string')
    .map((candidate) => candidate.id),
);
const pending = words
  .filter((word) => word.rank >= startRank && !completed.has(word.id))
  .slice(0, limit);

const batches: CourseExample[][] = [];
for (let index = 0; index < pending.length; index += batchSize) {
  batches.push(pending.slice(index, index + batchSize));
}

console.log(
  `${pending.length} ${dataset.languageName} examples need an English reading across ${batches.length} batches.`,
);

const systemPrompt = `You translate ${dataset.languageName} example sentences into English for absolute beginners.

For every input record return exactly one entry with the same id and an "en" field.

Rules:
- Translate the whole sentence, naturally, the way an English speaker would say it.
- Keep it one sentence, and keep the same tense, number and register as the source.
- The headword is the point of the sentence, so translate it in the sense the English gloss gives, not another sense of the same spelling.
- Keep proper names as they are.
- End with the same kind of punctuation the source ends with.
- Do not explain, gloss, annotate, transliterate, or add anything in brackets.
- Do not return the ${dataset.languageName} sentence unchanged.
- Return exactly one entry per input record, in the same order. Eight records means eight entries.
- Reply with JSON only, no prose and no markdown fence.

Shape: {"entries":[{"id":"0001","en":""}]}`;

const client = createModelClient(baseURL);
let written = 0;

for (let index = 0; index < batches.length; index += concurrency) {
  const group = batches.slice(index, index + concurrency);
  const results = await Promise.all(
    group.map(async (batch) => {
      const response = await withRetry(
        () =>
          requestStructuredOutput({
            client,
            model,
            name: `${dataset.courseId}_example_translation_batch`,
            schema: outputSchema,
            systemPrompt,
            userPrompt: `Input records:\n${JSON.stringify(
              batch.map((word) => ({
                id: word.id,
                term: word.term,
                english: word.english,
                example: word.example,
              })),
            )}`,
            compatibleEndpoint: Boolean(baseURL),
          }),
        4,
      );

      const byId = new Map(
        response.parsed.entries.map((entry) => [entry.id, entry]),
      );
      const missing = batch.filter((word) => !byId.has(word.id));
      if (missing.length > 0) {
        throw new Error(
          `Model skipped ids: ${missing.map((word) => word.id).join(', ')}`,
        );
      }

      return batch.map((word): ExampleTranslationCandidate => {
        const value = String(byId.get(word.id)!.en ?? '')
          .normalize('NFC')
          .trim();
        const check = checkExampleTranslation(value, word.example);
        return {
          id: word.id,
          rank: word.rank,
          term: word.term,
          example: word.example,
          exampleEnglish: value,
          flags: check.flags,
          model,
          promptVersion,
          generatedAt: nowIso(),
        };
      });
    }),
  );

  for (const candidates of results) {
    for (const candidate of candidates) {
      await appendJsonLine(outputPath, candidate);
      written += 1;
    }
  }
  console.log(
    `Translated ${Math.min(index + concurrency, batches.length)}/${batches.length} batches (${written} examples).`,
  );
}

console.log(`Example translation complete. ${written} examples written.`);
