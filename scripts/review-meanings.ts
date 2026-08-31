import 'dotenv/config';
import { z } from 'zod/v4';
import {
  type LanguageCode,
  isLanguageCode,
  languageByCode,
} from '../src/lib/languages';
import { getNumberOption, getOption, hasFlag } from './lib/cli';
import { checkMeaning } from './lib/meaning-checks';
import { appendJsonLine, nowIso, readJson, readJsonLines } from './lib/io';
import { fromRoot } from './lib/paths';
import type { ImportedWord } from './lib/pipeline-types';
import { withRetry } from './lib/retry';
import { importedWordSchema } from './lib/schemas';
import {
  createModelClient,
  requestStructuredOutput,
} from './lib/structured-output';

const promptVersion = 'meaning-review-v1';
const candidatesPath = getOption(
  'candidates',
  fromRoot('data/curated/meaning-candidates.jsonl'),
)!;
const outputPath = getOption(
  'output',
  fromRoot('data/curated/meaning-reviews.jsonl'),
)!;
const batchSize = getNumberOption('batch-size', 14);
const concurrency = getNumberOption('concurrency', 2);
const limit = getNumberOption('limit', Number.POSITIVE_INFINITY);
const model = getOption('model', process.env.OPENAI_REVIEW_MODEL);
// reviewing all six thousand meanings on a local model takes hours for a two percent
// intervention rate, so --risky spends that budget where the errors actually are:
// grammatical function words, and anything the deterministic checks already rejected
const riskyOnly = hasFlag('risky');
const baseURL = getOption('base-url', process.env.OPENAI_BASE_URL);

const requested = (getOption('languages') ?? 'es,de,it,pt,ar,zh')
  .split(',')
  .map((code) => code.trim())
  .filter(Boolean);
for (const code of requested) {
  if (!isLanguageCode(code)) throw new Error(`Unknown language code ${code}`);
}
const codes = requested as LanguageCode[];

if (!model) throw new Error('OPENAI_REVIEW_MODEL or --model is required');

type MeaningCandidate = {
  id: string;
  french: string;
  meanings: Record<string, string>;
};

type MeaningReview = {
  id: string;
  code: string;
  decision: 'approve' | 'reject';
  reason: string;
  suggested: string | null;
  model: string;
  promptVersion: string;
  reviewedAt: string;
};

// the reviewer needs the same glosses the generator had, or it judges a function word
// with no idea which sense was intended and "corrects" a right answer into a wrong one
const glosses = new Map<
  string,
  { english: string; persian: string; riskFlags: string[] }
>();
for (const record of await readJson<unknown[]>(
  fromRoot('data/curated/imported-words.json'),
)) {
  const parsed = importedWordSchema.safeParse(record);
  if (!parsed.success) continue;
  const word = parsed.data as ImportedWord;
  glosses.set(word.id, {
    english: word.english,
    persian: word.persian,
    riskFlags: word.riskFlags,
  });
}

const candidates = new Map<string, MeaningCandidate>();
for (const candidate of await readJsonLines<MeaningCandidate>(candidatesPath)) {
  candidates.set(candidate.id, candidate);
}

const done = new Set(
  (await readJsonLines<MeaningReview>(outputPath)).map(
    (review) => `${review.id}:${review.code}`,
  ),
);

// one review request covers one language at a time, so the reviewer can hold that
// language's conventions in mind instead of switching scripts every line
type ReviewTask = { code: LanguageCode; entries: MeaningCandidate[] };
const tasks: ReviewTask[] = [];
for (const code of codes) {
  const pending = [...candidates.values()].filter((candidate) => {
    const value = candidate.meanings[code];
    if (typeof value !== 'string' || !value.trim()) return false;
    if (done.has(`${candidate.id}:${code}`)) return false;
    if (!riskyOnly) return true;

    const flags = glosses.get(candidate.id)?.riskFlags ?? [];
    const isFunctionWord = flags.some(
      (flag) => flag !== 'ordinary-lexical-item',
    );
    const failedChecks = !checkMeaning(value, candidate.french, code).passed;
    return isFunctionWord || failedChecks;
  });
  for (let index = 0; index < pending.length; index += batchSize) {
    tasks.push({ code, entries: pending.slice(index, index + batchSize) });
  }
}

const outputSchema = z.object({
  entries: z.array(
    z.object({
      id: z.string(),
      correct: z.boolean(),
      reason: z.string(),
      suggested: z.string(),
    }),
  ),
});

console.log(
  `Reviewing ${tasks.length} batches across ${codes.join(', ')}${riskyOnly ? ' (risky entries only)' : ''}.`,
);

const client = createModelClient(baseURL);
const selected = tasks.slice(0, limit);
let approved = 0;
let corrected = 0;
let rejected = 0;

for (let index = 0; index < selected.length; index += concurrency) {
  const group = selected.slice(index, index + concurrency);
  const results = await Promise.all(
    group.map(async (task) => {
      const language = languageByCode.get(task.code)!;
      const systemPrompt = `You check ${language.label} translations of single French vocabulary entries.

Each record carries the French word, an English gloss, a Persian gloss, and a proposed ${language.label} translation. The two glosses are the authority on which sense is meant.

Decide whether the proposal is a correct dictionary meaning of the French word in the sense those glosses describe.

Mark correct as false ONLY when the translation is actually wrong:
- it is a false friend or a lookalike of the French word with a different meaning
- it gives a sense the French word does not have, or the wrong sense of an ambiguous word
- it is in the wrong language or the wrong script
- it is a sentence, an explanation, or a romanisation instead of the term
- the part of speech does not match

Do not mark it false for style. All of these are correct and must be approved:
- a short gloss carrying two close senses separated by a semicolon
- a broader or narrower synonym that a learner dictionary would also list
- a translation you would have worded differently but which means the same thing

When you are unsure, approve. Removing a correct meaning is worse than keeping a
wording you would not have chosen.

When correct is false, put a corrected ${language.label} translation in suggested. When correct is true, repeat the proposed translation in suggested. Keep suggested short and in ${language.label} script. Never answer in French or English unless that is the target language.`;

      const response = await withRetry(
        () =>
          requestStructuredOutput({
            client,
            model,
            name: 'meaning_review_batch',
            schema: outputSchema,
            systemPrompt,
            userPrompt: `Target language: ${language.label}\n\nRecords:\n${JSON.stringify(
              task.entries.map((entry) => ({
                id: entry.id,
                french: entry.french,
                english: glosses.get(entry.id)?.english ?? '',
                persian: glosses.get(entry.id)?.persian ?? '',
                proposed: entry.meanings[task.code],
              })),
            )}`,
            compatibleEndpoint: Boolean(baseURL),
          }),
        4,
      );

      const byId = new Map(
        response.parsed.entries.map((entry) => [entry.id, entry]),
      );
      return task.entries.map((entry): MeaningReview => {
        const verdict = byId.get(entry.id);
        const proposed = entry.meanings[task.code]!;
        const suggested = (verdict?.suggested ?? '').normalize('NFC').trim();

        // a correction is only taken when it passes the same checks a fresh
        // candidate has to pass, so review cannot introduce a worse value
        const usable =
          suggested &&
          suggested !== proposed &&
          checkMeaning(suggested, entry.french, task.code).passed;

        if (!verdict || verdict.correct) {
          return {
            id: entry.id,
            code: task.code,
            decision: 'approve',
            reason: verdict?.reason ?? 'no verdict returned',
            suggested: null,
            model,
            promptVersion,
            reviewedAt: nowIso(),
          };
        }

        return {
          id: entry.id,
          code: task.code,
          decision: usable ? 'approve' : 'reject',
          reason: verdict.reason,
          suggested: usable ? suggested : null,
          model,
          promptVersion,
          reviewedAt: nowIso(),
        };
      });
    }),
  );

  for (const reviews of results) {
    for (const review of reviews) {
      await appendJsonLine(outputPath, review);
      if (review.suggested) corrected += 1;
      else if (review.decision === 'approve') approved += 1;
      else rejected += 1;
    }
  }
  console.log(
    `Reviewed ${Math.min(index + concurrency, selected.length)}/${selected.length} batches. approved ${approved}, corrected ${corrected}, rejected ${rejected}.`,
  );
}

console.log(
  `Meaning review complete. approved ${approved}, corrected ${corrected}, rejected ${rejected}.`,
);
