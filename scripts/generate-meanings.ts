import 'dotenv/config';
import { z } from 'zod/v4';
import {
  type LanguageCode,
  isLanguageCode,
  languageByCode,
} from '../src/lib/languages';
import { getNumberOption, getOption } from './lib/cli';
import { checkMeaning } from './lib/meaning-checks';
import { appendJsonLine, nowIso, readJson, readJsonLines } from './lib/io';
import { fromRoot } from './lib/paths';
import { requirePassedImportAudit } from './lib/pipeline-gates';
import type { ImportedWord } from './lib/pipeline-types';
import { withRetry } from './lib/retry';
import { importedWordSchema } from './lib/schemas';
import {
  createModelClient,
  requestStructuredOutput,
} from './lib/structured-output';

const promptVersion = 'meanings-v1';
const inputPath = getOption(
  'input',
  fromRoot('data/curated/imported-words.json'),
)!;
const outputPath = getOption(
  'output',
  fromRoot('data/curated/meaning-candidates.jsonl'),
)!;
const batchSize = getNumberOption('batch-size', 12);
const concurrency = getNumberOption('concurrency', 4);
const startRank = getNumberOption('start-rank', 1);
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const model = getOption('model', process.env.OPENAI_MEANING_MODEL);
const baseURL = getOption('base-url', process.env.OPENAI_BASE_URL);

const requested = (getOption('languages') ?? 'es,de,it,pt,ar,zh')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);
for (const code of requested) {
  if (!isLanguageCode(code)) throw new Error(`Unknown language code ${code}`);
  if (languageByCode.get(code as LanguageCode)!.bundled) {
    throw new Error(
      `${code} is a bundled baseline meaning, not generated here`,
    );
  }
}
const codes = requested as LanguageCode[];

if (!model) throw new Error('OPENAI_MEANING_MODEL or --model is required');
if (!Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error('--concurrency must be a positive integer');
}

const source = await readJson<unknown[]>(inputPath);
const words = source.map((record, index) => {
  const parsed = importedWordSchema.safeParse(record);
  if (!parsed.success) {
    throw new Error(`Invalid imported word ${index}: ${parsed.error.message}`);
  }
  return parsed.data as ImportedWord;
});
await requirePassedImportAudit(
  fromRoot('data/curated/import-audit.json'),
  words.length,
);

type MeaningCandidate = {
  id: string;
  rank: number;
  french: string;
  meanings: Record<string, string>;
  flags: Record<string, string[]>;
  warnings: Record<string, string[]>;
  model: string;
  promptVersion: string;
  generatedAt: string;
};

// one request covers every requested language for a batch of words, which keeps the
// sense consistent across languages and cuts the number of calls by a factor of six
const entryShape: Record<string, z.ZodString> = { id: z.string() };
for (const code of codes) entryShape[code] = z.string();
const outputSchema = z.object({
  entries: z.array(z.object(entryShape)),
});

const existing = await readJsonLines<MeaningCandidate>(outputPath);
const completed = new Set(
  existing
    .filter((candidate) =>
      codes.every((code) => typeof candidate.meanings[code] === 'string'),
    )
    .map((candidate) => candidate.id),
);
const pending = words
  .filter((word) => word.rank >= startRank && !completed.has(word.id))
  .slice(0, limit);

const batches: ImportedWord[][] = [];
for (let index = 0; index < pending.length; index += batchSize) {
  batches.push(pending.slice(index, index + batchSize));
}

console.log(
  `${pending.length} words need meanings in ${codes.join(', ')} across ${batches.length} batches.`,
);

const languageLines = codes
  .map((code) => {
    const language = languageByCode.get(code)!;
    return `- "${code}": ${language.label} (${language.endonym}), written in its own script`;
  })
  .join('\n');

const systemPrompt = `You translate single French vocabulary entries for absolute beginners.

For every input record return exactly one entry with the same id, and one field per requested language:
${languageLines}

Rules:
- Translate the meaning the English and Persian glosses describe, not another sense of the same spelling.
- Give the dictionary meaning of the word itself, not a sentence and not a definition.
- Keep it short. One term is best. Use a semicolon to separate at most two close senses.
- Match the part of speech of the French word. Give verbs as infinitives.
- For a grammatical function word with no standalone translation, give the closest equivalent word in that language rather than an explanation.
- Write each language in its own native script. Never answer in French or English unless that is the requested language.
- Do not copy the French word back. Do not add commentary, romanisation, articles in brackets, or notes.`;

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
            name: 'french_meaning_batch',
            schema: outputSchema,
            systemPrompt,
            userPrompt: `Requested languages: ${codes.join(', ')}\n\nInput records:\n${JSON.stringify(
              batch.map((word) => ({
                id: word.id,
                french: word.french,
                english: word.english,
                persian: word.persian,
              })),
            )}`,
            compatibleEndpoint: Boolean(baseURL),
          }),
        4,
      );

      const byId = new Map(
        response.parsed.entries.map((entry) => [entry.id as string, entry]),
      );
      const missing = batch.filter((word) => !byId.has(word.id));
      if (missing.length > 0) {
        throw new Error(
          `Model skipped ids: ${missing.map((word) => word.id).join(', ')}`,
        );
      }

      return batch.map((word): MeaningCandidate => {
        const entry = byId.get(word.id)!;
        const meanings: Record<string, string> = {};
        const flags: Record<string, string[]> = {};
        const warnings: Record<string, string[]> = {};
        for (const code of codes) {
          const value = String(entry[code] ?? '')
            .normalize('NFC')
            .trim();
          meanings[code] = value;
          const check = checkMeaning(value, word.french, code);
          if (check.flags.length > 0) flags[code] = check.flags;
          if (check.warnings.length > 0) warnings[code] = check.warnings;
        }
        return {
          id: word.id,
          rank: word.rank,
          french: word.french,
          meanings,
          flags,
          warnings,
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
    `Generated ${Math.min(index + concurrency, batches.length)}/${batches.length} batches (${written} words).`,
  );
}

console.log(`Meaning generation complete. ${written} words written.`);
