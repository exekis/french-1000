import { z } from 'zod/v4';
import { checkExample, findDuplicateExamples } from './lib/example-checks';
import { nowIso, readJson, readJsonLines, writeJsonLines } from './lib/io';
import { fromRoot } from './lib/paths';
import type { ExampleCandidate, ImportedWord } from './lib/pipeline-types';

const overrideSchema = z.object({
  id: z.string().regex(/^\d{4}$/),
  exampleFrench: z.string().min(1),
});

const words = await readJson<ImportedWord[]>(
  fromRoot('data/curated/imported-words.json'),
);
const wordsById = new Map(words.map((word) => [word.id, word]));
const overrides = (
  await readJson<unknown[]>(fromRoot('data/curated/example-overrides.json'))
).map((record) => overrideSchema.parse(record));
const candidates = await readJsonLines<ExampleCandidate>(
  fromRoot('data/curated/example-candidates.jsonl'),
);
const candidatesById = new Map(
  candidates.map((candidate) => [candidate.id, candidate]),
);

for (const override of overrides) {
  const word = wordsById.get(override.id);
  if (!word) throw new Error(`Override ${override.id} has no imported word`);
  const existing = candidatesById.get(override.id);
  if (existing) {
    if (
      existing.model === 'curated-exception' &&
      existing.exampleFrench === override.exampleFrench
    ) {
      continue;
    }
    throw new Error(`Override ${override.id} conflicts with a candidate`);
  }

  const candidate: ExampleCandidate = {
    id: word.id,
    rank: word.rank,
    french: word.french,
    exampleFrench: override.exampleFrench.normalize('NFC'),
    exampleTarget: word.french,
    model: 'curated-exception',
    promptVersion: 'literal-target-overrides-v1',
    generatedAt: nowIso(),
  };
  const check = checkExample(candidate, word);
  if (!check.passed) {
    throw new Error(
      `Override ${override.id} failed checks: ${check.flags.join(', ')}`,
    );
  }
  candidatesById.set(candidate.id, candidate);
}

const merged = [...candidatesById.values()].toSorted(
  (left, right) => left.rank - right.rank,
);
const duplicates = findDuplicateExamples(merged);
if (duplicates.size > 0) {
  throw new Error(
    `Overrides created duplicate examples: ${JSON.stringify([...duplicates])}`,
  );
}
await writeJsonLines(fromRoot('data/curated/example-candidates.jsonl'), merged);
console.log(`Applied ${overrides.length} validated example overrides.`);
