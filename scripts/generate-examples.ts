import 'dotenv/config';
import { getNumberOption, getOption, hasFlag } from './lib/cli';
import {
  appendJsonLine,
  nowIso,
  readJson,
  readJsonLines,
  writeJson,
} from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type { ExampleCandidate, ImportedWord } from './lib/pipeline-types';
import { withRetry } from './lib/retry';
import {
  createModelClient,
  requestStructuredOutput,
} from './lib/structured-output';
import {
  exampleCandidateOutputSchema,
  importedWordSchema,
} from './lib/schemas';

const promptVersion = 'examples-v5';
const inputPath = getOption(
  'input',
  fromRoot('data/curated/imported-words.json'),
)!;
const outputPath = getOption(
  'output',
  fromRoot('data/curated/example-candidates.jsonl'),
)!;
const batchSize = getNumberOption('batch-size', 20);
const concurrency = getNumberOption('concurrency', 1);
const startRank = getNumberOption('start-rank', 1);
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const prepareOnly = hasFlag('prepare-only');
const model = getOption('model', process.env.OPENAI_EXAMPLE_MODEL);
const baseURL = getOption('base-url', process.env.OPENAI_BASE_URL);

const source = await readJson<unknown[]>(inputPath);
const words = source.map((record, index) => {
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
const existing = await readJsonLines<ExampleCandidate>(outputPath);
const completedIds = new Set(existing.map((candidate) => candidate.id));
const pending = words
  .filter((word) => word.rank >= startRank && !completedIds.has(word.id))
  .slice(0, limit);

const preparedBatches: ImportedWord[][] = [];
for (let index = 0; index < pending.length; index += batchSize) {
  preparedBatches.push(pending.slice(index, index + batchSize));
}

if (prepareOnly) {
  await writeJson(
    fromRoot('data/local/example-generation-batches.json'),
    preparedBatches,
  );
  console.log(
    `Prepared ${preparedBatches.length} batches for ${pending.length} words.`,
  );
  process.exit();
}

if (!model) {
  throw new Error('OPENAI_EXAMPLE_MODEL or --model is required');
}

const client = createModelClient(baseURL);
const systemPrompt = `You write concise teaching examples for absolute beginners learning French.

For every input record, return exactly one entry with the same id.
- Write natural contemporary French at A1 or A2 level.
- Usually use 5 to 10 words.
- Teach the intended English and Persian sense, not another homograph.
- The sentence must contain the exact supplied french field as a standalone word or phrase, copied character-for-character.
- exampleTarget must exactly equal the supplied french field.
- Do not conjugate, pluralize, elide, or otherwise alter the required target. For an infinitive, use a natural construction such as Je vais partir or Je veux partir.
- Use a complete sentence of at least three words and end it with normal sentence punctuation.
- Avoid unexplained idioms, rare proper nouns, offensive content, and advanced grammar.
- Do not translate the sentence or add commentary.`;

if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('--concurrency must be a positive integer');
}

for (let index = 0; index < preparedBatches.length; index += concurrency) {
  const group = preparedBatches.slice(index, index + concurrency);
  const generated = await Promise.all(
    group.map(async (batch) => {
      const response = await withRetry(() =>
        requestStructuredOutput({
          client,
          model,
          name: 'french_example_batch',
          schema: exampleCandidateOutputSchema,
          systemPrompt,
          userPrompt: `Input records:\n${JSON.stringify(
            batch.map((word) => ({
              id: word.id,
              rank: word.rank,
              french: word.french,
              english: word.english,
              persian: word.persian,
              riskFlags: word.riskFlags,
            })),
          )}\n\nMandatory literal targets:\n${batch
            .map(
              (word) =>
                `${word.id}: exampleFrench must literally contain ${JSON.stringify(word.french)} and exampleTarget must be exactly ${JSON.stringify(word.french)}`,
            )
            .join(
              '\n',
            )}\nCheck these literal requirements character by character before returning JSON.`,
          compatibleEndpoint: Boolean(baseURL),
        }),
      );

      const byId = new Map(
        response.parsed.entries.map((entry) => [entry.id, entry]),
      );
      const expectedIds = new Set(batch.map((word) => word.id));
      const unexpected = [...byId.keys()].filter((id) => !expectedIds.has(id));
      const missing = [...expectedIds].filter((id) => !byId.has(id));
      if (
        unexpected.length > 0 ||
        missing.length > 0 ||
        byId.size !== batch.length
      ) {
        throw new Error(
          `Model returned mismatched ids. Missing: ${missing.join(', ') || 'none'}. Unexpected: ${unexpected.join(', ') || 'none'}.`,
        );
      }

      return {
        batch,
        response,
        candidates: batch.map((word): ExampleCandidate => {
          const entry = byId.get(word.id)!;
          return {
            id: word.id,
            rank: word.rank,
            french: word.french,
            exampleFrench: entry.exampleFrench.normalize('NFC').trim(),
            exampleTarget: entry.exampleTarget.normalize('NFC').trim(),
            model,
            promptVersion,
            generatedAt: nowIso(),
          };
        }),
      };
    }),
  );

  for (const result of generated) {
    for (const candidate of result.candidates) {
      await appendJsonLine(outputPath, candidate);
    }
    await appendJsonLine(fromRoot('data/local/example-generation-log.jsonl'), {
      responseId: result.response.id,
      model,
      promptVersion,
      ids: result.batch.map((word) => word.id),
      usage: result.response.usage,
      completedAt: nowIso(),
    });
    console.log(
      `Generated ${result.batch[0]!.id} through ${result.batch.at(-1)!.id}.`,
    );
  }
}

console.log(`Example generation complete. ${pending.length} candidates added.`);
